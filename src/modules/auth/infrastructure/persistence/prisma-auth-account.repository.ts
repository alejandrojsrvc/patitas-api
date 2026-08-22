import { Injectable } from '@nestjs/common';
import type { ProviderIdentity } from '../../../../shared/application/ports/identity-provider.interface';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { User, UserRole } from '../../../users/domain/entities/user.entity';
import { ExternalIdentityConflictError } from '../../domain/errors/external-identity-conflict.error';
import type { AuthAccountRepository } from '../../domain/repositories/auth-account.repository';

@Injectable()
export class PrismaAuthAccountRepository implements AuthAccountRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async provision(identity: ProviderIdentity): Promise<User> {
    if (!identity.email) {
      throw new ExternalIdentityConflictError();
    }

    return this.prisma.$transaction(async (transaction) => {
      const linked = await transaction.externalIdentity.findUnique({
        where: {
          provider_providerUserId: {
            provider: identity.provider,
            providerUserId: identity.providerUserId,
          },
        },
        include: { user: true },
      });
      if (linked) {
        if (linked.user.role === 'CUSTOMER') {
          const customer = await transaction.customer.findUnique({
            where: { userId: linked.user.id },
          });
          if (!customer) {
            await transaction.customer.create({
              data: {
                userId: linked.user.id,
                fullName: linked.user.email,
                email: linked.user.email,
              },
            });
          }
        }
        return toDomainUser(linked.user);
      }

      const normalizedEmail = identity.email!.trim().toLowerCase();
      const existingUser = await transaction.user.findUnique({
        where: { email: normalizedEmail },
        include: { externalIdentities: true, customer: true },
      });
      if (existingUser && !identity.emailVerified) {
        throw new ExternalIdentityConflictError();
      }

      let user = existingUser;
      if (!user) {
        const domainUser = User.create(normalizedEmail);
        user = await transaction.user.create({
          data: {
            id: domainUser.id,
            email: domainUser.email,
            role: domainUser.role,
            customer: {
              create: {
                fullName: domainUser.email,
                email: domainUser.email,
              },
            },
          },
          include: { externalIdentities: true, customer: true },
        });
      } else if (user.role === 'CUSTOMER' && !user.customer) {
        await transaction.customer.create({
          data: { userId: user.id, fullName: user.email, email: user.email },
        });
      }

      await transaction.externalIdentity.create({
        data: {
          provider: identity.provider,
          providerUserId: identity.providerUserId,
          userId: user.id,
        },
      });
      return toDomainUser(user);
    });
  }

  public async grantAdminByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { externalIdentities: true },
    });
    if (!existing || existing.externalIdentities.length === 0) {
      return null;
    }
    const updated = await this.prisma.user.update({
      where: { id: existing.id },
      data: { role: UserRole.ADMIN },
    });
    return toDomainUser(updated);
  }
}

const toDomainUser = (user: {
  id: string;
  email: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}) =>
  User.reconstitute(user.id, {
    email: user.email,
    role: user.role as UserRole,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
