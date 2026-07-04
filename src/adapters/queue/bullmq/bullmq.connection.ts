import { config } from '@/shared/config/config';

// Passamos opções (não uma instância ioredis) pro BullMQ gerenciar as
// conexões dele, evitando conflito com o ioredis que ele traz embutido.
const url = new URL(config.REDIS_URL);

export const redisConnection = {
  host: url.hostname,
  port: Number(url.port) || 6379,
};
