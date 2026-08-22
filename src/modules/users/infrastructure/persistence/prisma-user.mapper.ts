import { User, UserRole } from '../../domain/entities/user.entity';

interface PersistenceUser {
  id: string;
  email: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PrismaUserMapper {
  public static toDomain(user: PersistenceUser): User {
    return User.reconstitute(user.id, {
      email: user.email,
      role: user.role as UserRole,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }

  public static toPersistence(user: User): PersistenceUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
