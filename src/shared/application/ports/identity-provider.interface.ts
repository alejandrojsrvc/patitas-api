export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');

export interface IdentityCredentials {
  email: string;
  password: string;
}

export interface ProviderIdentity {
  provider: string;
  providerUserId: string;
  email: string | null;
}

export interface IdentitySession {
  identity: ProviderIdentity;
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
}

export interface IdentityRegistration {
  identity: ProviderIdentity;
  session: IdentitySession | null;
}

export interface IdentityProvider {
  register(credentials: IdentityCredentials): Promise<IdentityRegistration>;
  login(credentials: IdentityCredentials): Promise<IdentitySession>;
  refresh(refreshToken: string): Promise<IdentitySession>;
  verifyToken(accessToken: string): Promise<ProviderIdentity>;
}
