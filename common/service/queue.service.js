import { config } from '../config/index.js';

let queueInstance = null;

export const initQueue = async (queueName, workerHandler) => {
  if (config.redis.isConfigured) {
    try {
      const { Queue, Worker } = await import('bullmq');
      const IORedis = (await import('ioredis')).default;

      const connection = new IORedis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        maxRetriesPerRequest: null,
      });

      queueInstance = new Queue(queueName, { connection });

      new Worker(queueName, workerHandler, { connection });
      console.log(`[QueueService] BullMQ queue "${queueName}" initialized with Redis.`);
      return queueInstance;
    } catch (err) {
      console.warn('[QueueService] Redis queue initialization failed, operating directly:', err.message);
      queueInstance = null;
    }
  }
  return null;
};

export const addJob = async (jobName, jobData, fallbackDirectFn) => {
  if (queueInstance) {
    return queueInstance.add(jobName, jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  // Direct async processing without blocking
  setImmediate(async () => {
    try {
      await fallbackDirectFn(jobData);
    } catch (err) {
      console.error('[QueueService] Direct job execution error:', err.message);
    }
  });
};
