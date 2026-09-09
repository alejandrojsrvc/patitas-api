import { Injectable } from '@nestjs/common';
import type { ProviderIdentity } from '../../../../shared/application/ports/identity-provider.interface';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { User, UserRole } from '../../../users/domain/entities/user.entity';
import { ExternalIdentityConflictError } from '../../domain/errors/external-identity-conflict.error';
import type { AuthAccountRepository } from '../../domain/repositories/auth-account.repository';

@Injectable()
export class PrismaAuthAccountRepository implements AuthAccountRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async resolve(identity: ProviderIdentity): Promise<User | null> {
    if (identity.provider !== 'patitas') return null;
    const account = await this.prisma.user.findUnique({
      where: { id: identity.providerUserId },
      include: { credential: true },
    });
    if (!account?.credential?.emailVerifiedAt || account.status !== 'ACTIVE') return null;
    return toDomainUser(account);
  }

  public async provision(identity: ProviderIdentity): Promise<User> {
    const account = await this.resolve(identity);
    if (!account) throw new ExternalIdentityConflictError();
    return account;
  }

  public async findIdentityByEmail(email: string): Promise<ProviderIdentity | null> {
    const account = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { credential: true },
    });
    if (!account?.credential) return null;
    return {
      provider: 'patitas',
      providerUserId: account.id,
      email: account.email,
      emailVerified: Boolean(account.credential.emailVerifiedAt),
    };
  }

  public async grantAdminByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { credential: true },
    });
    if (!existing?.credential) {
      return null;
    }
    const updated = await this.prisma.user.update({
      where: { id: existing.id },
      data: { role: UserRole.ADMIN },
    });
    return toDomainUser(updated);
  }
}

const toDomainUser = (user: { id: string; email: string; role: string; createdAt: Date; updatedAt: Date }) =>
  User.reconstitute(user.id, {
    email: user.email,
    role: user.role as UserRole,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
