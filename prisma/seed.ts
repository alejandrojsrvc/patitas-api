import { PrismaPg } from '@prisma/adapter-pg';
import { config as loadEnv } from 'dotenv';
import { assertLocalDatabaseUrl } from '../scripts/database-safety';
import { PrismaClient } from '../src/infrastructure/database/generated/prisma/client';
import { argon2id } from 'hash-wasm';
import { randomBytes } from 'node:crypto';

loadEnv({
  path: ['.env.local', '.env'],
  quiet: true,
});

const connectionString = process.env['DATABASE_URL'];
assertLocalDatabaseUrl(connectionString, process.env);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: connectionString! }),
});

const main = async (): Promise<void> => {
  const passwordHash = await argon2id({
    password: process.env['LOCAL_ADMIN_PASSWORD'] ?? 'PatitasLocal123!',
    salt: randomBytes(16),
    parallelism: 1,
    iterations: 2,
    memorySize: 19_456,
    hashLength: 32,
    outputType: 'encoded',
  });
  await prisma.user.upsert({
    where: { email: 'admin@patitas.local' },
    update: {
      role: 'ADMIN',
      status: 'ACTIVE',
      credential: {
        upsert: {
          create: { passwordHash, emailVerifiedAt: new Date() },
          update: { passwordHash, emailVerifiedAt: new Date() },
        },
      },
    },
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'admin@patitas.local',
      role: 'ADMIN',
      credential: {
        create: { passwordHash, emailVerifiedAt: new Date() },
      },
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
