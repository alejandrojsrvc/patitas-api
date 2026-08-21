import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Post,
} from '@nestjs/common';
import { CreateUserUseCase } from '../../application/use-cases/create-user.use-case';
import { InvalidUserEmailError } from '../../domain/errors/invalid-user-email.error';
import { UserEmailAlreadyExistsError } from '../../domain/errors/user-email-already-exists.error';
import { CreateUserDto } from '../dto/create-user.dto';
import { UserResponseDto } from '../dto/user-response.dto';

@Controller('users')
export class UsersController {
  public constructor(private readonly createUser: CreateUserUseCase) {}

  @Post()
  public async create(@Body() input: CreateUserDto): Promise<UserResponseDto> {
    try {
      const user = await this.createUser.execute(input);
      return UserResponseDto.fromDomain(user);
    } catch (error) {
      if (error instanceof UserEmailAlreadyExistsError) {
        throw new ConflictException(error.message);
      }
      if (error instanceof InvalidUserEmailError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
