import type { ProviderIdentity } from './identity-provider.interface';

export interface IdentityAdminProvider {
  inviteUser(email: string, redirectTo: string): Promise<ProviderIdentity>;
}
