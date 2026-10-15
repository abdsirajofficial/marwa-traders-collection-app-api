import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export const generateAuthToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      code: user.code,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
};

export const verifyToken = (token) => {
  return jwt.verify(token, config.jwtSecret);
};
