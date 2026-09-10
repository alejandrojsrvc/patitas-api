import { PrismaPg } from '@prisma/adapter-pg';
import { randomBytes } from 'node:crypto';
import { argon2id } from 'hash-wasm';
import prismaClientModule from '../dist/infrastructure/database/generated/prisma/client.js';

const { PrismaClient } = prismaClientModule;
const email = readArgument('--email').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? '';

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
  throw new Error('Debes proporcionar un email válido con --email.');
}
if (password.length < 8 || password.length > 128) {
  throw new Error('ADMIN_PASSWORD debe tener entre 8 y 128 caracteres.');
}

const connectionString = process.env.DIRECT_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
if (!connectionString) {
  throw new Error('DIRECT_DATABASE_URL o DATABASE_URL es obligatoria.');
}

const main = async () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const now = new Date();
  const passwordHash = await argon2id({
    password,
    salt: randomBytes(16),
    parallelism: 1,
    iterations: 2,
    memorySize: 19_456,
    hashLength: 32,
    outputType: 'encoded',
  });

  try {
    const user = await prisma.$transaction(async (transaction) => {
      const account = await transaction.user.upsert({
        where: { email },
        update: {
          role: 'ADMIN',
          status: 'ACTIVE',
          credential: {
            upsert: {
              create: { passwordHash, emailVerifiedAt: now, passwordChangedAt: now },
              update: {
                passwordHash,
                emailVerifiedAt: now,
                passwordChangedAt: now,
                failedLoginCount: 0,
                lockedUntil: null,
              },
            },
          },
        },
        create: {
          email,
          role: 'ADMIN',
          status: 'ACTIVE',
          credential: {
            create: { passwordHash, emailVerifiedAt: now, passwordChangedAt: now },
          },
        },
        select: { id: true, email: true },
      });

      await transaction.authSession.updateMany({
        where: { userId: account.id, revokedAt: null },
        data: { revokedAt: now },
      });
      return account;
    });

    console.info(`Usuario ADMIN listo: ${user.email} (${user.id}).`);
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'No se pudo crear el usuario ADMIN.');
  process.exitCode = 1;
});

function readArgument(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`Falta el argumento ${name}.`);
  return value;
}
