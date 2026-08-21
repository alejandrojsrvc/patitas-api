import type { UseCase } from '../../../../shared/application/use-case';
import { User } from '../../domain/entities/user.entity';
import { UserEmailAlreadyExistsError } from '../../domain/errors/user-email-already-exists.error';
import type { UserRepository } from '../../domain/repositories/user.repository';

export interface CreateUserInput {
  email: string;
}

export class CreateUserUseCase implements UseCase<CreateUserInput, User> {
  public constructor(private readonly userRepository: UserRepository) {}

  public async execute(input: CreateUserInput): Promise<User> {
    const user = User.create(input.email);
    const existingUser = await this.userRepository.findByEmail(user.email);

    if (existingUser) {
      throw new UserEmailAlreadyExistsError(user.email);
    }

    return this.userRepository.save(user);
  }
}
