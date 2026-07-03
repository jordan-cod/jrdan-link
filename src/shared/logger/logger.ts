import pino from 'pino';

import { config } from '@/shared/config/config';

export const logger = pino({
  level: config.LOG_LEVEL,
  formatters: {
    level: (label) => ({ level: label }),
  },
});
