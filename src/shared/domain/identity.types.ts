export interface ProviderIdentity {
  provider: string;
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
}
