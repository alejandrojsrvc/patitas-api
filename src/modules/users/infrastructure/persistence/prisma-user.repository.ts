import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import type { User } from '../../domain/entities/user.entity';
import { UserEmailAlreadyExistsError } from '../../domain/errors/user-email-already-exists.error';
import type { UserRepository } from '../../domain/repositories/user.repository';
import { PrismaUserMapper } from './prisma-user.mapper';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? PrismaUserMapper.toDomain(user) : null;
  }

  public async save(user: User): Promise<User> {
    try {
      const createdUser = await this.prisma.user.create({
        data: PrismaUserMapper.toPersistence(user),
      });
      return PrismaUserMapper.toDomain(createdUser);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new UserEmailAlreadyExistsError(user.email);
      }
      throw error;
    }
  }
}
