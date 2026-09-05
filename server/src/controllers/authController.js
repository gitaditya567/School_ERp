import User from '../models/User.js';
import School from '../models/School.js';
import { asyncHandler, ApiError, audit } from '../utils/helpers.js';
import { signToken } from '../middleware/auth.js';
import { publicRole, ROLES, PERMISSIONS, PERMISSION_LABELS } from '../config/roles.js';

/** GET /api/auth/status — tells the client whether the very first admin still has to be created. */
export const status = asyncHandler(async (_req, res) => {
  const count = await User.countDocuments();
  const school = await School.current();
  res.json({ ok: true, needsSetup: count === 0, school: { name: school.name, logo: school.logo, branch: school.branch } });
});

/** POST /api/auth/bootstrap — creates the first Principal. Refuses once any user exists. */
export const bootstrap = asyncHandler(async (req, res) => {
  if (await User.countDocuments()) throw new ApiError(409, 'Setup is already done. Please sign in.');
  const { name, email, password, schoolName } = req.body;
  const user = new User({ name, email, role: 'principal' });
  await user.setPassword(password);
  await user.save();
  if (schoolName) {
    const school = await School.current();
    school.name = schoolName;
    await school.save();
  }
  res.status(201).json({ ok: true, token: signToken(user), user: user.toPublic(), role: publicRole(user.role) });
});

/** POST /api/auth/login */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+passwordHash');
  if (!user) throw new ApiError(401, 'No account is registered with this email.');
  if (!user.active) throw new ApiError(403, 'This account has been deactivated.');
  if (!(await user.verifyPassword(password))) throw new ApiError(401, 'Incorrect password. Try again.');

  user.lastLoginAt = new Date();
  await user.save();
  req.user = user;
  await audit(req, 'auth.login', 'User', user._id);

  res.json({ ok: true, token: signToken(user), user: user.toPublic(), role: publicRole(user.role) });
});

/** GET /api/auth/me */
export const me = asyncHandler(async (req, res) => {
  const school = await School.current();
  await req.user.populate({ path: 'classId', select: 'name code' });
  res.json({
    ok: true,
    user: { ...req.user.toPublic(), className: req.user.classId?.name || null },
    role: publicRole(req.user.role),
    school,
  });
});

/** POST /api/auth/password */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await user.verifyPassword(currentPassword))) throw new ApiError(401, 'Your current password is not correct.');
  await user.setPassword(newPassword);
  await user.save();
  await audit(req, 'auth.password', 'User', user._id);
  res.json({ ok: true, message: 'Password changed.' });
});

/** GET /api/roles — full matrix, for the Settings screen. */
export const roleMatrix = asyncHandler(async (_req, res) => {
  res.json({
    ok: true,
    permissions: PERMISSIONS,
    labels: PERMISSION_LABELS,
    roles: Object.keys(ROLES).map(publicRole),
  });
});
