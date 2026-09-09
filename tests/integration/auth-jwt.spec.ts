import { PrismaPg } from '@prisma/adapter-pg';
import type { ConfigService } from '@nestjs/config';
import { JwtIdentityAdapter } from '../../src/infrastructure/identity/jwt/jwt-identity.adapter';
import { PrismaClient } from '../../src/infrastructure/database/generated/prisma/client';

const connectionString = process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@127.0.0.1:54322/patitas';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const email = 'jwt-integration@patitas.local';

const values: Record<string, string | number> = {
  AUTH_JWT_ISSUER: 'patitas-api-test',
  AUTH_JWT_AUDIENCE: 'patitas-test-clients',
  AUTH_ACCESS_TOKEN_TTL_SECONDS: 900,
  AUTH_REFRESH_TOKEN_TTL_DAYS: 30,
  AUTH_EMAIL_CONFIRMATION_TTL_MINUTES: 1_440,
  AUTH_PASSWORD_RECOVERY_TTL_MINUTES: 30,
};
const config = {
  get: (key: string) => values[key],
  getOrThrow: (key: string) => {
    const value = values[key];
    if (value === undefined) throw new Error(`Missing ${key}`);
    return value;
  },
} as unknown as ConfigService;

describe('JwtIdentityAdapter integration', () => {
  let adapter: JwtIdentityAdapter;

  beforeAll(async () => {
    await prisma.$connect();
    adapter = new JwtIdentityAdapter(prisma as never, config);
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  afterAll(() => prisma.$disconnect());

  it('confirms, authenticates and immediately revokes a session', async () => {
    const registration = await adapter.register({ email, password: 'CorrectHorseBatteryStaple1!' });
    expect(registration.session).toBeNull();
    const session = await adapter.confirmEmail(registration.emailConfirmation!.token, 'signup');
    await expect(adapter.verifyToken(session.accessToken)).resolves.toMatchObject({ email, emailVerified: true });

    await adapter.logout(session.accessToken);
    await expect(adapter.verifyToken(session.accessToken)).rejects.toThrow('La operación de autenticación no fue válida.');
  });

  it('rotates refresh tokens and revokes the family when an old token is reused', async () => {
    const registration = await adapter.register({ email, password: 'CorrectHorseBatteryStaple1!' });
    await adapter.confirmEmail(registration.emailConfirmation!.token, 'signup');
    const login = await adapter.login({ email, password: 'CorrectHorseBatteryStaple1!' });
    const rotated = await adapter.refresh(login.refreshToken);

    await expect(adapter.refresh(login.refreshToken)).rejects.toThrow('La operación de autenticación no fue válida.');
    await expect(adapter.refresh(rotated.refreshToken)).rejects.toThrow('La operación de autenticación no fue válida.');
  });

  it('consumes password recovery tokens once and revokes existing sessions', async () => {
    const registration = await adapter.register({ email, password: 'CorrectHorseBatteryStaple1!' });
    await adapter.confirmEmail(registration.emailConfirmation!.token, 'signup');
    const login = await adapter.login({ email, password: 'CorrectHorseBatteryStaple1!' });
    const recovery = await adapter.createPasswordRecovery(email);

    await adapter.resetPassword(recovery!.token, 'AnotherCorrectPassword2!');
    await expect(adapter.verifyToken(login.accessToken)).rejects.toThrow();
    await expect(adapter.resetPassword(recovery!.token, 'ThirdCorrectPassword3!')).rejects.toThrow();
    await expect(adapter.login({ email, password: 'AnotherCorrectPassword2!' })).resolves.toBeDefined();
  });
});
