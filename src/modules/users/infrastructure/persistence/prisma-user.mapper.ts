import { User } from '../../domain/entities/user.entity';

interface PersistenceUser {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PrismaUserMapper {
  public static toDomain(user: PersistenceUser): User {
    return User.reconstitute(user.id, {
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }

  public static toPersistence(user: User): PersistenceUser {
    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
