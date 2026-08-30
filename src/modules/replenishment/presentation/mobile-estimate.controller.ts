import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomerService } from '../../customers/application/customer.service';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/presentation/authenticated-user';
import { UserRole } from '../../users/domain/entities/user.entity';
import { EstimateService } from '../application/estimate.service';
import { EstimateValidationError } from '../application/estimate.service';
import { PetService } from '../../pets/application/pet.service';
import { CatalogService } from '../../catalog/application/catalog.service';
import { CreateMobileEstimateDto } from './mobile-estimate.dto';
import { toMobileEstimate } from './mobile-estimate.mapper';

@ApiTags('Customer mobile replenishment estimates')
@ApiBearerAuth()
@Roles(UserRole.CUSTOMER)
@UseGuards(AuthGuard, RolesGuard)
@Controller('mobile/replenishment-estimates')
export class MobileEstimateController {
  public constructor(
    private readonly estimates: EstimateService,
    private readonly customers: CustomerService,
    private readonly pets: PetService,
    private readonly catalog: CatalogService,
  ) {}

  @Post()
  @HttpCode(200)
  public async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateMobileEstimateDto,
  ) {
    const customerId = (await this.customers.findByUserId(user.userId)).id;
    const pet = input.petId
      ? await this.pets.findOwned(input.petId, customerId)
      : input.pet;
    if (!pet) throw new EstimateValidationError('Se requiere una mascota.');
    const product = input.variantId
      ? await this.catalog.getPublicProductByVariantId(input.variantId)
      : null;
    const food = product
      ? { productId: product.id, variantId: input.variantId! }
      : input.food;
    if (!food) throw new EstimateValidationError('Se requiere un alimento.');
    const estimate = await this.estimates.create(customerId, {
      pet: {
        id: pet.id,
        name: pet.name,
        species: pet.species,
        weightKg: Number(pet.weightKg),
        lifeStage: pet.lifeStage,
        breed: pet.breed,
      },
      food,
      bagStartedAt: input.bagStartedAt
        ? new Date(input.bagStartedAt)
        : undefined,
      remainingBucket: input.remainingBucket,
    });
    return toMobileEstimate(estimate);
  }
}
