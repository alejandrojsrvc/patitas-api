import type { User } from '../../domain/entities/user.entity';

export class UserResponseDto {
  public id!: string;
  public email!: string;
  public role!: string;
  public createdAt!: string;
  public updatedAt!: string;

  public static fromDomain(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
