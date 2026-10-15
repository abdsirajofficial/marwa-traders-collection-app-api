import { config } from './index.js';

export const redisConfig = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  isConfigured: config.redis.isConfigured,
};
