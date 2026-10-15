import crypto from 'crypto';

export const hashPin = (pin) => {
  return crypto.createHash('sha256').update(String(pin)).digest('hex');
};

export const generateSecureId = (prefix = 'ID') => {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
};
