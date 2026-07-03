import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/adapters/database/postgresql/schema',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
