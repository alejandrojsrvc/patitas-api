import type { IdentitySession } from '../../../shared/application/ports/identity-provider.interface';
import type { User } from '../../users/domain/entities/user.entity';

export interface AuthenticatedResult {
  status: 'authenticated';
  user: User;
  session: IdentitySession;
}

export interface VerificationRequiredResult {
  status: 'verification_required';
  user: null;
}

export type RegistrationResult =
  AuthenticatedResult | VerificationRequiredResult;
