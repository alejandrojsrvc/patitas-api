import type { ProviderIdentity } from '../../../../shared/domain/identity.types';
import type { User } from '../../../users/domain/entities/user.entity';

export const AUTH_ACCOUNT_REPOSITORY = Symbol('AUTH_ACCOUNT_REPOSITORY');

export interface AuthAccountRepository {
  provision(identity: ProviderIdentity): Promise<User>;
  findIdentityByEmail(email: string): Promise<ProviderIdentity | null>;
  grantAdminByEmail(email: string): Promise<User | null>;
}
