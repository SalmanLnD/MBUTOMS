import { applyCorsHeaders } from '../utils/cors.js';

export const notFound = (req, res, next) => {
  const error = new Error(`Not found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export const errorHandler = (err, req, res, next) => {
  console.error(`[API Error] ${req.method} ${req.path}:`, err.message);
  const fallback = res.statusCode === 200 ? 500 : res.statusCode;
  const statusCode = err.statusCode || (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : err.code === 11000 ? 409 : fallback);
  applyCorsHeaders(req, res);
  if (res.headersSent) return next(err);
  res.status(statusCode).json({
    message: err.message || 'Internal server error',
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};
