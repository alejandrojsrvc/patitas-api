import { Injectable } from '@nestjs/common';
import type { Session, User } from '@supabase/supabase-js';
import { ProviderOperationError } from '../../../shared/application/provider-error';
import type {
  IdentityCredentials,
  IdentityProvider,
  IdentityRegistration,
  IdentitySession,
  ProviderIdentity,
} from '../../../shared/application/ports/identity-provider.interface';
import { SupabaseAuthClient } from './supabase-auth.client';

@Injectable()
export class SupabaseIdentityAdapter implements IdentityProvider {
  public constructor(private readonly authClient: SupabaseAuthClient) {}

  public async register(
    credentials: IdentityCredentials,
  ): Promise<IdentityRegistration> {
    const { data, error } = await this.authClient.client.auth.signUp({
      email: credentials.email,
      password: credentials.password,
    });

    if (error || !data.user) {
      throw this.error('register', error);
    }

    return {
      identity: this.toIdentity(data.user),
      session: data.session ? this.toSession(data.session) : null,
    };
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
    };
  }

  private error(operation: string, cause: unknown): ProviderOperationError {
    return new ProviderOperationError(
      'supabase',
      operation,
      `Supabase Identity no pudo completar ${operation}.`,
      cause instanceof Error ? { cause } : undefined,
    );
  }
}
