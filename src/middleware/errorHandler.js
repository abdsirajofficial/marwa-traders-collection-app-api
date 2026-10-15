import { config } from '../config/env.js';

export const errorHandler = (err, req, res, next) => {
  console.error(`[Error] ${req.method} ${req.url}:`, err);

  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);

  const response = {
    success: false,
    message: err.message || 'Internal Server Error',
  };

  // Only expose stack trace in non-production environments
  if (config.env !== 'production' && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};
