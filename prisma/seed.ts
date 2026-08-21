import { PrismaPg } from '@prisma/adapter-pg';
import { config as loadEnv } from 'dotenv';
import { assertLocalDatabaseUrl } from '../scripts/database-safety';
import { PrismaClient } from '../src/infrastructure/database/generated/prisma/client';

loadEnv({
  path: ['.env.supabase.local', '.env.local', '.env'],
  quiet: true,
});

const connectionString = process.env['DATABASE_URL'];
assertLocalDatabaseUrl(connectionString, process.env);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: connectionString! }),
});

const main = async (): Promise<void> => {
  await prisma.user.upsert({
    where: { email: 'demo@patitas.local' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'demo@patitas.local',
    },
  });
};

main()
  .then(async () => prisma.$disconnect())
  .catch(async () => {
    await prisma.$disconnect();
    console.error('No se pudo ejecutar el seed local.');
    process.exit(1);
  });
