import { redisConfig } from './redis.config.js';

export const queueConfig = {
  notificationQueueName: 'whatsapp-notifications',
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
  },
  redis: redisConfig,
};
