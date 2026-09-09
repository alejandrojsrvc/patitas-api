import { PrismaPg } from '@prisma/adapter-pg';
import { createElement } from 'react';
import { createHash, randomBytes } from 'node:crypto';
import { Resend } from 'resend';
import { loadProjectEnv } from './load-project-env';
import { PrismaClient } from '../src/infrastructure/database/generated/prisma/client';
import { AdminInvitationEmail } from '../src/infrastructure/notifications/email-templates/admin-invitation.email';

loadProjectEnv();

const email = readArgument('--email').trim().toLowerCase();
const confirmation = readArgument('--confirm').trim().toLowerCase();
if (!isEmail(email) || confirmation !== email) {
  throw new Error('Debes proporcionar un email válido y repetirlo exactamente con --confirm.');
}

const connectionString = requiredEnvironment('DIRECT_DATABASE_URL');
const appUrl = new URL(requiredEnvironment('RESEND_APP_URL'));
const resend = new Resend(requiredEnvironment('RESEND_API_KEY'));
const from = requiredEnvironment('RESEND_FROM_EMAIL');
const token = randomBytes(32).toString('base64url');
const actionUrl = new URL('/auth/accept-invitation', appUrl);
actionUrl.searchParams.set('token', token);

const main = async (): Promise<void> => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const userId = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.user.findUnique({ where: { email }, include: { credential: true } });
      if (existing?.credential?.passwordHash || existing?.credential?.emailVerifiedAt) {
        throw new Error('La cuenta ya fue activada.');
      }
      const user = existing
        ? await transaction.user.update({
            where: { id: existing.id },
            data: {
              role: 'ADMIN',
              status: 'ACTIVE',
              ...(!existing.credential ? { credential: { create: {} } } : {}),
            },
          })
        : await transaction.user.create({
            data: { email, role: 'ADMIN', credential: { create: {} } },
          });
      await transaction.authActionToken.updateMany({
        where: { userId: user.id, type: 'ADMIN_INVITATION', consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await transaction.authActionToken.create({
        data: {
          userId: user.id,
          type: 'ADMIN_INVITATION',
          tokenHash: createHash('sha256').update(token).digest('hex'),
          expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
        },
      });
      return user.id;
    });

    const result = await resend.emails.send({
      from,
      to: [email],
      subject: 'Invitación administrativa | Patitas Inquietas',
      react: createElement(AdminInvitationEmail, { actionUrl: actionUrl.toString() }),
      ...(process.env['RESEND_REPLY_TO']?.trim() ? { replyTo: process.env['RESEND_REPLY_TO'].trim() } : {}),
    });
    if (result.error) throw new Error('Resend rechazó la invitación.');
    console.info(`Invitación administrativa creada para ${email} (${userId}).`);
  } finally {
    await prisma.$disconnect();
  }
};

void main();

function readArgument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`Falta el argumento ${name}.`);
  return value;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`La variable ${name} es obligatoria.`);
  return value;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
