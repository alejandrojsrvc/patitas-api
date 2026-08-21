import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';
import { assertSafePrismaCommand } from './scripts/database-safety';

loadEnv({
  path: ['.env.supabase.local', '.env.local', '.env'],
  quiet: true,
});

assertSafePrismaCommand(process.argv, process.env);

// `generate` y `validate` no necesitan conectarse. El placeholder permite que
// `pnpm install` genere el cliente antes de levantar Supabase local.
const databaseUrl =
  process.env['DATABASE_URL']?.trim() ||
  'postgresql://missing:missing@127.0.0.1:1/missing';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: databaseUrl,
  },
});
