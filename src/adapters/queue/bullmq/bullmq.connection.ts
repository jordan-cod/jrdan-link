import { config } from '@/shared/config/config';

const url = new URL(config.REDIS_URL);

export const redisConnection = {
  host: url.hostname,
  port: Number(url.port) || 6379,
};
