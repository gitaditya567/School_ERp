import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { roleOf } from '../config/roles.js';
import { ApiError, asyncHandler } from '../utils/helpers.js';

export const signToken = (user) => jwt.sign(
  { sub: String(user._id) },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES || '7d' },
);

const userCache = new Map();
const USER_CACHE_TTL = 30 * 1000; // 30 seconds

export const invalidateUserCache = (id) => {
  if (id) userCache.delete(String(id));
  else userCache.clear();
};

export const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Please sign in to continue.');

  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); }
  catch { throw new ApiError(401, 'Your session has expired. Please sign in again.'); }

  const now = Date.now();
  let user = userCache.get(payload.sub);
  if (!user || now - user._cachedAt > USER_CACHE_TTL) {
    user = await User.findById(payload.sub);
    if (!user || !user.active) throw new ApiError(401, 'This account is no longer active.');
    user._cachedAt = now;
    userCache.set(payload.sub, user);
  } else if (!user.active) {
    userCache.delete(payload.sub);
    throw new ApiError(401, 'This account is no longer active.');
  }

  req.user = user;
  req.role = roleOf(user.role);
  // class teachers are limited to their own class everywhere
  req.scopeClass = user.role === 'teacher' && user.classId ? String(user.classId) : null;
  next();
});

/** Route guard: requirePerm('collect') */
export const requirePerm = (...perms) => (req, _res, next) => {
  const ok = perms.every((p) => req.role?.can?.[p]);
  if (!ok) {
    return next(new ApiError(403,
      `Your role (${req.role?.label || 'unknown'}) cannot ${perms.join(' + ')}. Ask the Principal if you need this.`));
  }
  return next();
};

export const requireView = (view) => (req, _res, next) => {
  if (!req.role?.views?.includes(view)) {
    return next(new ApiError(403, `The ${view} module is not available for your role.`));
  }
  return next();
};

/** Blocks a class teacher from touching a student outside her class. */
export const assertClassScope = (req, classId) => {
  if (req.scopeClass && String(classId) !== req.scopeClass) {
    throw new ApiError(403, 'This student is not in your class.');
  }
};
