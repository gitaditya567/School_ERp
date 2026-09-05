import { validationResult } from 'express-validator';
import { ApiError } from '../utils/helpers.js';

/** Turns express-validator output into one clear message + a field map. */
export const checkValidation = (req, _res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array();
  const fields = {};
  errors.forEach((e) => { if (!fields[e.path]) fields[e.path] = e.msg; });
  return next(new ApiError(422, errors[0].msg, fields));
};

export const notFound = (req, _res, next) => next(new ApiError(404, `No route for ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, _req, res, _next) => {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong.';
  let details = err.details;

  if (err.name === 'CastError') { status = 400; message = 'That id is not valid.'; }
  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'value';
    message = `That ${field} is already in use.`;
  }
  if (err.name === 'ValidationError') {
    status = 422;
    details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
    message = Object.values(details)[0];
  }
  if (status >= 500) console.error(err);
  res.status(status).json({ ok: false, message, details });
};
