import { Injectable } from '@nestjs/common';
import type { Session, User } from '@supabase/supabase-js';
import {
  ProviderAuthenticationError,
  ProviderOperationError,
} from '../../../shared/application/provider-error';
import type {
  IdentityCredentials,
  EmailConfirmationType,
  IdentityEmailAction,
  IdentityProvider,
  IdentityRegistration,
  IdentitySession,
  ProviderIdentity,
} from '../../../shared/application/ports/identity-provider.interface';
import { SupabaseAuthClient } from './supabase-auth.client';
import { SupabaseIdentityAdminClient } from './supabase-identity-admin.client';

@Injectable()
export class SupabaseIdentityAdapter implements IdentityProvider {
  public constructor(
    private readonly authClient: SupabaseAuthClient,
    private readonly adminClient: SupabaseIdentityAdminClient,
  ) {}

  public async register(
    credentials: IdentityCredentials,
  ): Promise<IdentityRegistration> {
    const { data, error } =
      await this.adminClient.client.auth.admin.generateLink({
        type: 'signup',
        email: normalizeEmail(credentials.email),
        password: credentials.password,
        ...(credentials.displayName
          ? { options: { data: { full_name: credentials.displayName.trim() } } }
          : {}),
      });

    if (error || !data.user || !data.properties?.hashed_token) {
      throw this.error('register', error);
    }

    return {
      identity: this.toIdentity(data.user),
      session: null,
      emailConfirmation: {
        token: data.properties.hashed_token,
        type: 'signup',
      },
    };
  }

  public async createEmailConfirmation(
    email: string,
  ): Promise<IdentityEmailAction | null> {
    const { data, error } =
      await this.adminClient.client.auth.admin.generateLink({
        type: 'magiclink',
        email: normalizeEmail(email),
      });
    if (isMissingUser(error)) return null;
    if (error || !data.properties?.hashed_token) {
      throw this.error('createEmailConfirmation', error);
    }
    return { token: data.properties.hashed_token, type: 'magiclink' };
  }

  public async confirmEmail(
    token: string,
    type: EmailConfirmationType,
  ): Promise<IdentitySession> {
    const { data, error } = await this.authClient.client.auth.verifyOtp({
      token_hash: token,
      type,
    });
    if (error || !data.session) {
      throw this.error('confirmEmail', error ?? invalidTokenCause);
    }
    return this.toSession(data.session);
  }

  public async createPasswordRecovery(
    email: string,
  ): Promise<IdentityEmailAction | null> {
    const { data, error } =
      await this.adminClient.client.auth.admin.generateLink({
        type: 'recovery',
        email: normalizeEmail(email),
      });
    if (isMissingUser(error)) return null;
    if (error || !data.properties?.hashed_token) {
      throw this.error('createPasswordRecovery', error);
    }
    return { token: data.properties.hashed_token, type: 'recovery' };
  }

  public async resetPassword(token: string, password: string): Promise<void> {
    const { data, error } = await this.authClient.client.auth.verifyOtp({
      token_hash: token,
      type: 'recovery',
    });
    if (error || !data.user || !data.session) {
      throw this.error('resetPassword', error ?? invalidTokenCause);
    }
    const update = await this.adminClient.client.auth.admin.updateUserById(
      data.user.id,
      { password },
    );
    if (update.error) throw this.error('resetPassword', update.error);
    await this.adminClient.client.auth.admin
      .signOut(data.session.access_token, 'global')
      .catch(() => undefined);
  }

  public async login(
    credentials: IdentityCredentials,
  ): Promise<IdentitySession> {
    const { data, error } =
      await this.authClient.client.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

    if (error || !data.session) {
      throw this.error('login', error);
    }

    return this.toSession(data.session);
  }

  public async refresh(refreshToken: string): Promise<IdentitySession> {
    const { data, error } = await this.authClient.client.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      throw this.error('refresh', error);
    }

    return this.toSession(data.session);
  }

  public async verifyToken(accessToken: string): Promise<ProviderIdentity> {
    const { data, error } =
      await this.authClient.client.auth.getUser(accessToken);

    if (error || !data.user) {
      throw this.error('verifyToken', error);
    }

    return this.toIdentity(data.user);
  }

  private toSession(session: Session): IdentitySession {
    return {
      identity: this.toIdentity(session.user),
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at ?? null,
    };
  }

  private toIdentity(user: User): ProviderIdentity {
    return {
      provider: 'supabase',
      providerUserId: user.id,
      email: user.email ?? null,
      emailVerified: Boolean(user.email_confirmed_at),
      ...(readDisplayName(user) ? { displayName: readDisplayName(user) } : {}),
    };
  }

  private error(operation: string, cause: unknown): ProviderOperationError {
    if (isAuthenticationFailure(operation, cause)) {
      return new ProviderAuthenticationError(
        'supabase',
        operation,
        'La operación de autenticación no fue válida.',
        cause instanceof Error ? { cause } : undefined,
      );
    }
    return new ProviderOperationError(
      'supabase',
      operation,
      `Supabase Identity no pudo completar ${operation}.`,
      cause instanceof Error ? { cause } : undefined,
    );
  }
}

const isAuthenticationFailure = (
  operation: string,
  cause: unknown,
): boolean => {
  if (
    ![
      'login',
      'refresh',
      'verifyToken',
      'confirmEmail',
      'resetPassword',
    ].includes(operation)
  )
    return false;
  if (!cause || typeof cause !== 'object') return false;
  const error = cause as { status?: number; code?: string };
  return (
    error.status === 401 ||
    error.status === 400 ||
    error.status === 403 ||
    [
      'bad_jwt',
      'email_not_confirmed',
      'invalid_credentials',
      'invalid_token',
      'otp_expired',
      'session_not_found',
      'token_expired',
    ].includes(error.code ?? '')
  );
};

const isMissingUser = (cause: unknown): boolean => {
  if (!cause || typeof cause !== 'object') return false;
  const error = cause as { code?: string };
  return ['email_not_found', 'user_not_found'].includes(error.code ?? '');
};

const readDisplayName = (user: User): string | undefined => {
  const metadata: unknown = user.user_metadata;
  if (!metadata || typeof metadata !== 'object') return undefined;
  const value = (metadata as Record<string, unknown>)['full_name'];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const invalidTokenCause = { status: 401, code: 'invalid_token' };
