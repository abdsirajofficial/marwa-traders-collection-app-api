import { config } from '../config/index.js';

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);

  const response = {
    success: false,
    message: err.message || 'Internal Server Error',
  };

  if (config.env !== 'production' && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};
