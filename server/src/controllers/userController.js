import User from '../models/User.js';
import { asyncHandler, ApiError, audit } from '../utils/helpers.js';

export const list = asyncHandler(async (_req, res) => {
  const users = await User.find().populate('classId', 'name').sort('name');
  res.json({ ok: true, users: users.map((u) => ({ ...u.toPublic(), className: u.classId?.name || null })) });
});

export const create = asyncHandler(async (req, res) => {
  const { name, email, password, role, classId } = req.body;
  if (role === 'teacher' && !classId) throw new ApiError(422, 'A class teacher must be assigned to a class.');
  const user = new User({ name, email, role, classId: role === 'teacher' ? classId : null });
  await user.setPassword(password);
  await user.save();
  await audit(req, 'user.create', 'User', user._id, { role });
  res.status(201).json({ ok: true, user: user.toPublic() });
});

export const update = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');
  const { name, role, classId, active, password } = req.body;
  if (String(user._id) === String(req.user._id) && active === false) {
    throw new ApiError(400, 'You cannot deactivate your own account.');
  }
  if (name) user.name = name;
  if (role) { user.role = role; user.classId = role === 'teacher' ? classId || user.classId : null; }
  if (typeof active === 'boolean') user.active = active;
  if (password) await user.setPassword(password);
  await user.save();
  await audit(req, 'user.update', 'User', user._id);
  res.json({ ok: true, user: user.toPublic() });
});

export const remove = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) throw new ApiError(400, 'You cannot delete your own account.');
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');
  if (user.role === 'principal' && await User.countDocuments({ role: 'principal', active: true }) < 2) {
    throw new ApiError(400, 'At least one active Principal account must remain.');
  }
  await user.deleteOne();
  await audit(req, 'user.delete', 'User', req.params.id);
  res.json({ ok: true, message: 'User removed.' });
});
