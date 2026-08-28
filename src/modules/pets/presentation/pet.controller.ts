import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/presentation/authenticated-user';
import { CustomerService } from '../../customers/application/customer.service';
import { PetService } from '../application/pet.service';
import { CreatePetDto, UpdatePetDto } from './pet.dto';

@ApiTags('Customer pets')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('me/pets')
export class PetController {
  public constructor(
    private readonly pets: PetService,
    private readonly customers: CustomerService,
  ) {}

  @Get()
  public async list(@CurrentUser() user: AuthenticatedUser) {
    return this.pets.list((await this.customers.findByUserId(user.userId)).id);
  }

  @Post()
  public async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreatePetDto,
  ) {
    return this.pets.create(
      (await this.customers.findByUserId(user.userId)).id,
      input,
    );
  }

  @Patch(':petId')
  public async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('petId') petId: string,
    @Body() input: UpdatePetDto,
  ) {
    return this.pets.update(
      petId,
      (await this.customers.findByUserId(user.userId)).id,
      input,
    );
  }
}
