import { randomUUID } from 'node:crypto';
import { Entity } from '../../../../shared/domain/entity';
import { InvalidUserEmailError } from '../errors/invalid-user-email.error';

export interface UserProperties {
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export class User extends Entity {
  private constructor(
    id: string,
    private readonly properties: UserProperties,
  ) {
    super(id);
  }

  public static create(email: string, id: string = randomUUID()): User {
    const normalizedEmail = this.normalizeEmail(email);
    const now = new Date();
    return new User(id, {
      email: normalizedEmail,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(id: string, properties: UserProperties): User {
    return new User(id, {
      ...properties,
      email: this.normalizeEmail(properties.email),
    });
  }

  public get email(): string {
    return this.properties.email;
  }

  public get createdAt(): Date {
    return this.properties.createdAt;
  }

  public get updatedAt(): Date {
    return this.properties.updatedAt;
  }

  private static normalizeEmail(email: string): string {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new InvalidUserEmailError();
    }
    return normalizedEmail;
  }
}
