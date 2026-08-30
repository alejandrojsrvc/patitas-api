import type { ProviderIdentity } from '../../domain/identity.types';

export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');

export interface IdentityCredentials {
  email: string;
  password: string;
  displayName?: string;
}

export type EmailConfirmationType = 'signup' | 'magiclink';

export interface IdentityEmailAction {
  token: string;
  type: EmailConfirmationType | 'recovery';
}

export type { ProviderIdentity } from '../../domain/identity.types';

export interface IdentitySession {
  identity: ProviderIdentity;
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
}

export interface IdentityRegistration {
  identity: ProviderIdentity;
  session: IdentitySession | null;
  emailConfirmation?: IdentityEmailAction;
}

export interface IdentityProvider {
  register(credentials: IdentityCredentials): Promise<IdentityRegistration>;
  login(credentials: IdentityCredentials): Promise<IdentitySession>;
  refresh(refreshToken: string): Promise<IdentitySession>;
  verifyToken(accessToken: string): Promise<ProviderIdentity>;
  createEmailConfirmation(email: string): Promise<IdentityEmailAction | null>;
  confirmEmail(
    token: string,
    type: EmailConfirmationType,
  ): Promise<IdentitySession>;
  createPasswordRecovery(email: string): Promise<IdentityEmailAction | null>;
  resetPassword(token: string, password: string): Promise<void>;
}
