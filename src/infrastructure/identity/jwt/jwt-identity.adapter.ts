import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { argon2id, argon2Verify } from 'hash-wasm';
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, randomUUID, type KeyObject } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { ProviderAuthenticationError, ProviderOperationError } from '../../../shared/application/provider-error';
import type {
  EmailConfirmationType,
  IdentityCredentials,
  IdentityEmailAction,
  IdentityProvider,
  IdentityRegistration,
  IdentitySession,
  ProviderIdentity,
} from '../../../shared/application/ports/identity-provider.interface';

const joseModule: Promise<typeof import('jose')> = import('jose');

const PROVIDER = 'patitas';
const JWT_ALGORITHM = 'EdDSA';
const JWT_KEY_ID = 'primary';

@Injectable()
export class JwtIdentityAdapter implements IdentityProvider {
  private readonly logger = new Logger(JwtIdentityAdapter.name);
  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlDays: number;
  private readonly confirmationTtlMinutes: number;
  private readonly recoveryTtlMinutes: number;

  public constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.issuer = config.getOrThrow<string>('AUTH_JWT_ISSUER');
    this.audience = config.getOrThrow<string>('AUTH_JWT_AUDIENCE');
    this.accessTtlSeconds = config.getOrThrow<number>('AUTH_ACCESS_TOKEN_TTL_SECONDS');
    this.refreshTtlDays = config.getOrThrow<number>('AUTH_REFRESH_TOKEN_TTL_DAYS');
    this.confirmationTtlMinutes = config.getOrThrow<number>('AUTH_EMAIL_CONFIRMATION_TTL_MINUTES');
    this.recoveryTtlMinutes = config.getOrThrow<number>('AUTH_PASSWORD_RECOVERY_TTL_MINUTES');

    const configuredPrivateKey = config.get<string>('AUTH_JWT_PRIVATE_KEY_BASE64');
    const configuredPublicKey = config.get<string>('AUTH_JWT_PUBLIC_KEY_BASE64');
    if (configuredPrivateKey && configuredPublicKey) {
      this.privateKey = createPrivateKey({ key: Buffer.from(configuredPrivateKey, 'base64'), format: 'der', type: 'pkcs8' });
      this.publicKey = createPublicKey({ key: Buffer.from(configuredPublicKey, 'base64'), format: 'der', type: 'spki' });
    } else {
      const generated = generateKeyPairSync('ed25519');
      this.privateKey = generated.privateKey;
      this.publicKey = generated.publicKey;
      this.logger.warn('Usando claves JWT efímeras. Configurá claves persistentes antes de ejecutar más de una instancia.');
    }
  }

  public async register(credentials: IdentityCredentials): Promise<IdentityRegistration> {
    const email = normalizeEmail(credentials.email);
    const passwordHash = await this.hashPassword(credentials.password);
    const token = createOpaqueToken();
    let userId: string;
    try {
      userId = await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.user.findUnique({
          where: { email },
          include: { credential: true, customer: true },
        });
        if (existing?.credential) throw this.operationError('register', new Error('La cuenta ya existe.'));

        if (existing) {
          await transaction.user.update({
            where: { id: existing.id },
            data: {
              status: 'ACTIVE',
              credential: { create: { passwordHash } },
              ...(!existing.customer && existing.role === 'CUSTOMER'
                ? { customer: { create: { fullName: credentials.displayName?.trim() || email, email } } }
                : {}),
              authActionTokens: {
                create: {
                  type: 'EMAIL_CONFIRMATION',
                  tokenHash: digestToken(token),
                  expiresAt: addMinutes(this.confirmationTtlMinutes),
                },
              },
            },
          });
          return existing.id;
        }

        const created = await transaction.user.create({
          data: {
            id: randomUUID(),
            email,
            credential: { create: { passwordHash } },
            customer: { create: { fullName: credentials.displayName?.trim() || email, email } },
            authActionTokens: {
              create: {
                type: 'EMAIL_CONFIRMATION',
                tokenHash: digestToken(token),
                expiresAt: addMinutes(this.confirmationTtlMinutes),
              },
            },
          },
        });
        return created.id;
      });
    } catch (cause) {
      if (cause instanceof ProviderOperationError) throw cause;
      throw this.operationError('register', cause);
    }

    return {
      identity: toIdentity({ id: userId, email, emailVerifiedAt: null, displayName: credentials.displayName }),
      session: null,
      emailConfirmation: { token, type: 'signup' },
    };
  }

  public async activateGuest(credentials: IdentityCredentials): Promise<IdentitySession> {
    const email = normalizeEmail(credentials.email);
    const passwordHash = await this.hashPassword(credentials.password);
    let userId = '';
    await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.user.findUnique({ where: { email }, include: { credential: true } });
      if (existing) {
        if (existing.role !== 'CUSTOMER' || existing.status !== 'ACTIVE')
          throw this.operationError('guest activation', new Error('La cuenta no puede activarse.'));
        userId = existing.id;
        await transaction.user.update({
          where: { id: existing.id },
          data: {
            credential: {
              upsert: {
                create: { passwordHash, emailVerifiedAt: new Date() },
                update: { passwordHash, emailVerifiedAt: new Date(), passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
              },
            },
          },
        });
        return;
      }
      const created = await transaction.user.create({
        data: {
          id: randomUUID(),
          email,
          customer: { create: { fullName: credentials.displayName?.trim() || email, email } },
          credential: { create: { passwordHash, emailVerifiedAt: new Date() } },
        },
      });
      userId = created.id;
    });
    return this.createSession(userId, email, new Date());
  }

  public async login(credentials: IdentityCredentials): Promise<IdentitySession> {
    const email = normalizeEmail(credentials.email);
    const account = await this.prisma.user.findUnique({ where: { email }, include: { credential: true } });
    if (!account?.credential?.passwordHash || !account.credential.emailVerifiedAt || account.status !== 'ACTIVE') {
      throw this.authenticationError('login');
    }

    const now = new Date();
    if (account.credential.lockedUntil && account.credential.lockedUntil > now) {
      throw this.authenticationError('login');
    }

    if (!(await argon2Verify({ hash: account.credential.passwordHash, password: credentials.password }))) {
      const failedLoginCount = Math.min(account.credential.failedLoginCount + 1, 20);
      const lockMinutes = failedLoginCount >= 5 ? Math.min(2 ** (failedLoginCount - 5), 15) : 0;
      await this.prisma.authCredential.update({
        where: { userId: account.id },
        data: {
          failedLoginCount,
          lockedUntil: lockMinutes ? addMinutes(lockMinutes) : null,
        },
      });
      throw this.authenticationError('login');
    }

    await this.prisma.authCredential.update({
      where: { userId: account.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
    return this.createSession(account.id, account.email, account.credential.emailVerifiedAt);
  }

  public async refresh(refreshToken: string): Promise<IdentitySession> {
    const refreshTokenHash = digestToken(refreshToken);
    const existing = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash },
      include: { user: { include: { credential: true } } },
    });
    if (!existing) throw this.authenticationError('refresh');
    if (existing.revokedAt) {
      await this.prisma.authSession.updateMany({
        where: { tokenFamilyId: existing.tokenFamilyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw this.authenticationError('refresh');
    }
    if (existing.expiresAt <= new Date() || existing.user.status !== 'ACTIVE' || !existing.user.credential?.emailVerifiedAt) {
      throw this.authenticationError('refresh');
    }

    const nextRefreshToken = createOpaqueToken();
    const nextSessionId = randomUUID();
    const nextJti = randomUUID();
    const expiresAt = addDays(this.refreshTtlDays);
    const rotatedAt = new Date();
    await this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.authSession.updateMany({
        where: { id: existing.id, revokedAt: null },
        data: { revokedAt: rotatedAt, lastUsedAt: rotatedAt },
      });
      if (revoked.count !== 1) throw this.authenticationError('refresh');
      await transaction.authSession.create({
        data: {
          id: nextSessionId,
          userId: existing.userId,
          tokenFamilyId: existing.tokenFamilyId,
          refreshTokenHash: digestToken(nextRefreshToken),
          accessTokenJti: nextJti,
          expiresAt,
        },
      });
    });

    return this.toSession(existing.user, nextSessionId, nextJti, nextRefreshToken);
  }

  public async verifyToken(accessToken: string): Promise<ProviderIdentity> {
    try {
      const { jwtVerify } = await joseModule;
      const verified = await jwtVerify(accessToken, this.publicKey, {
        algorithms: [JWT_ALGORITHM],
        issuer: this.issuer,
        audience: this.audience,
      });
      const userId = verified.payload.sub;
      const sessionId = verified.payload['sid'];
      const tokenId = verified.payload.jti;
      if (!userId || typeof sessionId !== 'string' || !tokenId) throw new Error('JWT incompleto.');

      const session = await this.prisma.authSession.findUnique({
        where: { id: sessionId },
        include: { user: { include: { credential: true } } },
      });
      if (
        !session ||
        session.userId !== userId ||
        session.accessTokenJti !== tokenId ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        session.user.status !== 'ACTIVE' ||
        !session.user.credential?.emailVerifiedAt
      ) {
        throw new Error('Sesión inválida.');
      }
      return toIdentity({ id: session.user.id, email: session.user.email, emailVerifiedAt: session.user.credential.emailVerifiedAt });
    } catch (cause) {
      throw this.authenticationError('verifyToken', cause);
    }
  }

  public async createEmailConfirmation(email: string): Promise<IdentityEmailAction | null> {
    return this.createAction(email, 'EMAIL_CONFIRMATION', this.confirmationTtlMinutes, 'magiclink', true);
  }

  public async confirmEmail(token: string, _type: EmailConfirmationType): Promise<IdentitySession> {
    void _type;
    const account = await this.consumeAction(token, 'EMAIL_CONFIRMATION', async (transaction, userId) => {
      await transaction.authCredential.update({
        where: { userId },
        data: { emailVerifiedAt: new Date() },
      });
    });
    return this.createSession(account.id, account.email, new Date());
  }

  public async createPasswordRecovery(email: string): Promise<IdentityEmailAction | null> {
    return this.createAction(email, 'PASSWORD_RECOVERY', this.recoveryTtlMinutes, 'recovery', false);
  }

  public async resetPassword(token: string, password: string): Promise<void> {
    const passwordHash = await this.hashPassword(password);
    await this.consumeAction(token, 'PASSWORD_RECOVERY', async (transaction, userId) => {
      const now = new Date();
      await transaction.authCredential.update({
        where: { userId },
        data: { passwordHash, passwordChangedAt: now, failedLoginCount: 0, lockedUntil: null },
      });
      await transaction.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
    });
  }

  public async acceptInvitation(token: string, password: string): Promise<void> {
    const passwordHash = await this.hashPassword(password);
    await this.consumeAction(token, 'ADMIN_INVITATION', async (transaction, userId) => {
      const now = new Date();
      await transaction.authCredential.update({
        where: { userId },
        data: { passwordHash, passwordChangedAt: now, emailVerifiedAt: now, failedLoginCount: 0, lockedUntil: null },
      });
    });
  }

  public async logout(accessToken: string): Promise<void> {
    const payload = await this.verifiedPayload(accessToken, 'logout');
    await this.prisma.authSession.updateMany({
      where: { id: payload.sessionId, userId: payload.userId, accessTokenJti: payload.tokenId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  public async logoutAll(accessToken: string): Promise<void> {
    const payload = await this.verifiedPayload(accessToken, 'logoutAll');
    await this.prisma.authSession.updateMany({ where: { userId: payload.userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private async createSession(userId: string, email: string, emailVerifiedAt: Date): Promise<IdentitySession> {
    const refreshToken = createOpaqueToken();
    const sessionId = randomUUID();
    const tokenId = randomUUID();
    const expiresAt = addDays(this.refreshTtlDays);
    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId,
        tokenFamilyId: randomUUID(),
        refreshTokenHash: digestToken(refreshToken),
        accessTokenJti: tokenId,
        expiresAt,
      },
    });
    return this.toSession({ id: userId, email, credential: { emailVerifiedAt } }, sessionId, tokenId, refreshToken);
  }

  private async toSession(
    user: { id: string; email: string; credential?: { emailVerifiedAt: Date | null } | null },
    sessionId: string,
    tokenId: string,
    refreshToken: string,
  ): Promise<IdentitySession> {
    const expiresAt = Math.floor(Date.now() / 1_000) + this.accessTtlSeconds;
    const { SignJWT } = await joseModule;
    const accessToken = await new SignJWT({ sid: sessionId })
      .setProtectedHeader({ alg: JWT_ALGORITHM, kid: JWT_KEY_ID, typ: 'JWT' })
      .setSubject(user.id)
      .setJti(tokenId)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(this.privateKey);
    return {
      identity: toIdentity({ id: user.id, email: user.email, emailVerifiedAt: user.credential?.emailVerifiedAt ?? null }),
      accessToken,
      refreshToken,
      expiresAt,
    };
  }

  private async createAction(
    email: string,
    type: 'EMAIL_CONFIRMATION' | 'PASSWORD_RECOVERY' | 'ADMIN_INVITATION',
    ttlMinutes: number,
    actionType: EmailConfirmationType | 'recovery',
    onlyUnverified: boolean,
  ): Promise<IdentityEmailAction | null> {
    const account = await this.prisma.user.findUnique({ where: { email: normalizeEmail(email) }, include: { credential: true } });
    if (!account?.credential || account.status !== 'ACTIVE') return null;
    if (onlyUnverified === Boolean(account.credential.emailVerifiedAt)) return null;

    const recent = await this.prisma.authActionToken.findFirst({
      where: { userId: account.id, type, createdAt: { gt: addMinutes(-1) } },
      select: { id: true },
    });
    if (recent) return null;

    const token = createOpaqueToken();
    await this.prisma.$transaction([
      this.prisma.authActionToken.updateMany({
        where: { userId: account.id, type, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      this.prisma.authActionToken.create({
        data: { userId: account.id, type, tokenHash: digestToken(token), expiresAt: addMinutes(ttlMinutes) },
      }),
    ]);
    return { token, type: actionType };
  }

  private async consumeAction(
    token: string,
    type: 'EMAIL_CONFIRMATION' | 'PASSWORD_RECOVERY' | 'ADMIN_INVITATION',
    mutate: (transaction: Parameters<Parameters<PrismaService['$transaction']>[0]>[0], userId: string) => Promise<void>,
  ): Promise<{ id: string; email: string }> {
    const action = await this.prisma.authActionToken.findUnique({
      where: { tokenHash: digestToken(token) },
      include: { user: true },
    });
    if (!action || action.type !== type || action.consumedAt || action.expiresAt <= new Date() || action.user.status !== 'ACTIVE') {
      throw this.authenticationError(actionOperation(type));
    }
    await this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.authActionToken.updateMany({
        where: { id: action.id, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) throw this.authenticationError(actionOperation(type));
      await mutate(transaction, action.userId);
    });
    return { id: action.user.id, email: action.user.email };
  }

  private async verifiedPayload(accessToken: string, operation: string): Promise<{ userId: string; sessionId: string; tokenId: string }> {
    try {
      const { jwtVerify } = await joseModule;
      const verified = await jwtVerify(accessToken, this.publicKey, {
        algorithms: [JWT_ALGORITHM],
        issuer: this.issuer,
        audience: this.audience,
      });
      const userId = verified.payload.sub;
      const sessionId = verified.payload['sid'];
      const tokenId = verified.payload.jti;
      if (!userId || typeof sessionId !== 'string' || !tokenId) throw new Error('JWT incompleto.');
      return { userId, sessionId, tokenId };
    } catch (cause) {
      throw this.authenticationError(operation, cause);
    }
  }

  private hashPassword(password: string): Promise<string> {
    return argon2id({
      password,
      salt: randomBytes(16),
      parallelism: 1,
      iterations: 2,
      memorySize: 19_456,
      hashLength: 32,
      outputType: 'encoded',
    });
  }

  private authenticationError(operation: string, cause?: unknown): ProviderAuthenticationError {
    return new ProviderAuthenticationError(
      PROVIDER,
      operation,
      'La operación de autenticación no fue válida.',
      cause instanceof Error ? { cause } : undefined,
    );
  }

  private operationError(operation: string, cause: unknown): ProviderOperationError {
    return new ProviderOperationError(
      PROVIDER,
      operation,
      `Identity no pudo completar ${operation}.`,
      cause instanceof Error ? { cause } : undefined,
    );
  }
}

const createOpaqueToken = (): string => randomBytes(32).toString('base64url');
const digestToken = (token: string): string => createHash('sha256').update(token).digest('hex');
const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const addMinutes = (minutes: number): Date => new Date(Date.now() + minutes * 60_000);
const addDays = (days: number): Date => new Date(Date.now() + days * 86_400_000);
const actionOperation = (type: 'EMAIL_CONFIRMATION' | 'PASSWORD_RECOVERY' | 'ADMIN_INVITATION'): string =>
  type === 'EMAIL_CONFIRMATION' ? 'confirmEmail' : type === 'PASSWORD_RECOVERY' ? 'resetPassword' : 'acceptInvitation';

const toIdentity = (input: { id: string; email: string; emailVerifiedAt: Date | null; displayName?: string }): ProviderIdentity => ({
  provider: PROVIDER,
  providerUserId: input.id,
  email: input.email,
  emailVerified: Boolean(input.emailVerifiedAt),
  ...(input.displayName ? { displayName: input.displayName.trim() } : {}),
});
