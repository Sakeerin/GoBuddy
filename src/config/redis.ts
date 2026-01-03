import { createClient, RedisClientType } from 'redis';
import { logger } from '@/utils/logger';

let redisClient: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  redisClient = createClient({ url: redisUrl });

  redisClient.on('error', (err) => {
    logger.error('Redis Client Error', err);
  });

  redisClient.on('connect', () => {
    logger.info('Redis Client Connected');
  });

  await redisClient.connect();
  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    redisClient = null;
  }
}

