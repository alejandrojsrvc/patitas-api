import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../../../users/domain/entities/user.entity';

export const ROLES_METADATA = 'patitas:roles';
export const Roles = (...roles: UserRole[]) =>
  SetMetadata(ROLES_METADATA, roles);
