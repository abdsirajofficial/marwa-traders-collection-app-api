import { ApiError } from '../utils/api-error.util.js';

export const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    const message = error.errors?.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ') || error.message;
    return next(new ApiError(400, `Validation error: ${message}`));
  }
};
