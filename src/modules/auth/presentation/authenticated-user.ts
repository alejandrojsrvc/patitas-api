import type { Request } from 'express';
import type { UserRole } from '../../users/domain/entities/user.entity';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
