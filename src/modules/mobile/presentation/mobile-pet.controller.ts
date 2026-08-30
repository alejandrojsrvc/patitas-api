import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../auth/presentation/authenticated-user';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { UserRole } from '../../users/domain/entities/user.entity';
import { CustomerService } from '../../customers/application/customer.service';
import type {
  CreatePetInput,
  UpdatePetInput,
} from '../../pets/domain/pet.types';
import { PetService } from '../../pets/application/pet.service';
import { MobilePetCreateDto, MobilePetUpdateDto } from './mobile.dto';
import { normalizePetSex, toMobilePet } from './mobile.mapper';

@ApiTags('Mobile pets')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
@Controller('mobile/me/pets')
export class MobilePetController {
  public constructor(
    private readonly pets: PetService,
    private readonly customers: CustomerService,
  ) {}

  @Get()
  public async list(@CurrentUser() user: AuthenticatedUser) {
    const customer = await this.customers.findByUserId(user.userId);
    return (await this.pets.listForMobile(customer.id)).map(toMobilePet);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: MobilePetCreateDto,
  ) {
    const customer = await this.customers.findByUserId(user.userId);
    const pet = await this.pets.createForMobile(
      customer.id,
      toCreatePetInput(input),
    );
    return toMobilePet(pet);
  }

  @Patch(':petId')
  public async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('petId') petId: string,
    @Body() input: MobilePetUpdateDto,
  ) {
    const customer = await this.customers.findByUserId(user.userId);
    const pet = await this.pets.updateForMobile(
      petId,
      customer.id,
      toPetInput(input),
    );
    return toMobilePet(pet);
  }
}

const toPetInput = (
  input: MobilePetCreateDto | MobilePetUpdateDto,
): UpdatePetInput => {
  const { sex, birthDate, age, ...rest } = input;
  return {
    ...rest,
    ...(sex !== undefined ? { sex: normalizePetSex(sex) } : {}),
    ...(birthDate !== undefined
      ? { birthDate: birthDate ? parseDate(birthDate) : null }
      : age
        ? { birthDate: birthDateFromAge(age.value, age.unit) }
        : {}),
  };
};

const toCreatePetInput = (input: MobilePetCreateDto): CreatePetInput => ({
  ...toPetInput(input),
  name: input.name,
  species: input.species,
  weightKg: input.weightKg,
  lifeStage: input.lifeStage,
});

const parseDate = (value: string): Date =>
  new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

const birthDateFromAge = (value: number, unit: 'months' | 'years'): Date => {
  const date = new Date();
  if (unit === 'years') date.setUTCFullYear(date.getUTCFullYear() - value);
  else date.setUTCMonth(date.getUTCMonth() - value);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
};
