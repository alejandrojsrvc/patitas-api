import { PrismaPg } from '@prisma/adapter-pg';
import { config as loadEnv } from 'dotenv';
import { assertLocalDatabaseUrl } from './database-safety';
import { PrismaClient } from '../src/infrastructure/database/generated/prisma/client';

loadEnv({ path: ['.env.supabase.local', '.env.local', '.env'], quiet: true });
const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
  throw new Error('DATABASE_URL es obligatoria.');
}

const emailIndex = process.argv.indexOf('--email');
const email =
  emailIndex >= 0
    ? process.argv[emailIndex + 1]?.trim().toLowerCase()
    : undefined;
if (!email) {
  throw new Error('Uso: pnpm user:grant-admin -- --email persona@example.com');
}
const confirmationIndex = process.argv.indexOf('--confirm');
const confirmation =
  confirmationIndex >= 0 ? process.argv[confirmationIndex + 1] : undefined;
if (process.env['NODE_ENV'] === 'production') {
  if (confirmation !== email) {
    throw new Error('En producción debes repetir el email con --confirm.');
  }
} else {
  assertLocalDatabaseUrl(connectionString, process.env);
}

const main = async (): Promise<void> => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { externalIdentities: true },
    });
    if (!user || user.externalIdentities.length === 0) {
      throw new Error(
        'El usuario debe registrarse y vincular su identidad primero.',
      );
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' },
    });
    console.info(`Rol ADMIN concedido a ${email}.`);
  } finally {
    await prisma.$disconnect();
  }
};

void main();
