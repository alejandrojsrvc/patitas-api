import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { UserRole } from '../../users/domain/entities/user.entity';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/presentation/authenticated-user';
import { CustomerService } from '../../customers/application/customer.service';
import { PetService } from '../../pets/application/pet.service';
import { EstimateService } from '../application/estimate.service';
import {
  ReplenishmentService,
  ReplenishmentValidationError,
} from '../application/replenishment.service';
import { CartService } from '../../cart/application/cart.service';
import type { NotificationChannel } from '../domain/replenishment.types';
import { toMobileCart } from '../../cart/presentation/mobile-cart.mapper';
import {
  CreateMobileReplenishmentPlanDto,
  RecalibrateMobileReplenishmentPlanDto,
  ChangeMobileReplenishmentProductDto,
  ReorderMobileCartDto,
  StartMobileReplenishmentBagDto,
  UpdateMobileReplenishmentPlanDto,
} from './mobile-replenishment.dto';
import { toMobilePlan } from './mobile-replenishment.mapper';

@ApiTags('Customer mobile replenishment')
@ApiBearerAuth()
@ApiHeader({ name: 'Idempotency-Key', required: false })
@Roles(UserRole.CUSTOMER)
@UseGuards(AuthGuard, RolesGuard)
@Controller('mobile')
export class MobileReplenishmentController {
  public constructor(
    private readonly plans: ReplenishmentService,
    private readonly estimates: EstimateService,
    private readonly pets: PetService,
    private readonly customers: CustomerService,
    private readonly carts: CartService,
  ) {}

  @Get('me/replenishment-plans')
  public async list(@CurrentUser() user: AuthenticatedUser) {
    const customer = await this.customers.findByUserId(user.userId);
    return (await this.plans.list({ customerId: customer.id })).map(
      toMobilePlan,
    );
  }

  @Post('me/replenishment-plans')
  @HttpCode(HttpStatus.CREATED)
  public async create(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreateMobileReplenishmentPlanDto,
  ) {
    const customer = await this.customers.findByUserId(user.userId);
    const pet = await this.pets.findOwned(input.petId, customer.id);
    const estimate = await this.estimates.findOwned(
      input.estimateId,
      customer.id,
    );
    if (!estimate.productId || !estimate.variantId)
      throw new ReplenishmentValidationError(
        'Un alimento personalizado todavía no puede crear un plan de reposición.',
      );
    if (
      (input.productId && input.productId !== estimate.productId) ||
      (input.variantId && input.variantId !== estimate.variantId)
    )
      throw new ReplenishmentValidationError(
        'El producto no coincide con la estimación seleccionada.',
      );
    const channels = [
      ...new Set(
        input.reminderChannels.map((channel) => channel.toUpperCase()),
      ),
    ] as NotificationChannel[];
    if (!channels.length)
      throw new Error('Selecciona al menos un canal de recordatorio.');
    const plan = await this.plans.create(
      {
        idempotencyKey: idempotencyKey ?? null,
        petId: pet.id,
        estimateId: estimate.id,
        petName: pet.name,
        petSpecies: pet.species,
        petWeightKg: pet.weightKg,
        petLifeStage: pet.lifeStage,
        petBreed: pet.breed,
        productId: estimate.productId,
        variantId: estimate.variantId,
        dailyConsumption: (
          (estimate.dailyGrams.min + estimate.dailyGrams.max) /
          2
        ).toString(),
        dailyGramsMin: estimate.dailyGrams.min,
        dailyGramsMax: estimate.dailyGrams.max,
        consumptionUnit: 'GRAMS_PER_DAY',
        durationDaysMin: Math.max(1, Math.round(estimate.durationDays.min)),
        durationDaysMax: Math.max(1, Math.round(estimate.durationDays.max)),
        calculationSource: estimate.source,
        estimatedDepletionDate: estimate.estimatedDepletionDate,
        channel: channels.find((channel) => channel !== 'PUSH') ?? 'EMAIL',
        reminderChannels: channels,
        remindersEnabled: input.remindersEnabled,
        leadDays: input.leadDays,
        bagStartedAt: input.bagStartedAt ? new Date(input.bagStartedAt) : null,
        remainingBucket: input.remainingBucket ?? null,
        consentVersion: 'mobile-v1',
        destination: customer.email,
      },
      { customerId: customer.id },
    );
    const scheduled = await this.plans.updateMobileState(
      plan.id,
      { customerId: customer.id },
      { remindersEnabled: input.remindersEnabled, leadDays: input.leadDays },
    );
    return toMobilePlan(scheduled);
  }

  @Patch('me/replenishment-plans/:planId')
  public async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId') id: string,
    @Body() input: UpdateMobileReplenishmentPlanDto,
  ) {
    const customerId = (await this.customers.findByUserId(user.userId)).id;
    const plan = await this.plans.updateMobileState(
      id,
      { customerId },
      {
        status: input.status,
        nextReminderAt:
          input.nextReminderAt === undefined
            ? undefined
            : new Date(input.nextReminderAt),
        remindersEnabled: input.remindersEnabled,
        leadDays: input.leadDays,
      },
    );
    return toMobilePlan(plan);
  }

  @Post('me/replenishment-plans/:planId/recalibrate')
  public async recalibrate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId') id: string,
    @Body() input: RecalibrateMobileReplenishmentPlanDto,
  ) {
    const customerId = (await this.customers.findByUserId(user.userId)).id;
    const plan = await this.plans.find(id, { customerId });
    const remainingBucket = input.remainingBucket ?? input.bucket;
    if (!remainingBucket)
      throw new ReplenishmentValidationError(
        'Se requiere indicar cuánto alimento queda.',
      );
    const days = daysForBucket(remainingBucket, plan.durationDaysMax);
    return toMobilePlan(
      await this.plans.recalibrate(
        id,
        { customerId },
        days,
        remainingBucket,
        input.observedAt ? new Date(input.observedAt) : undefined,
      ),
    );
  }

  @Post('me/replenishment-plans/:planId/change-product')
  public async changeProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId') id: string,
    @Body() input: ChangeMobileReplenishmentProductDto,
  ) {
    const customerId = (await this.customers.findByUserId(user.userId)).id;
    return toMobilePlan(
      await this.plans.changeProduct(
        id,
        { customerId },
        input.productId,
        input.variantId,
        {
          bagStartedAt: input.bagStartedAt
            ? new Date(input.bagStartedAt)
            : undefined,
          remainingBucket: input.remainingBucket,
        },
      ),
    );
  }

  @Post('me/replenishment-plans/:planId/start-bag')
  public async startBag(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId') id: string,
    @Body() input: StartMobileReplenishmentBagDto,
  ) {
    const customerId = (await this.customers.findByUserId(user.userId)).id;
    const plan = await this.plans.startBag(
      id,
      { customerId },
      {
        orderId: input.orderId,
        orderLineId: input.orderLineId,
        startedAt: new Date(input.startedAt),
      },
    );
    return {
      plan: toMobilePlan(plan),
      order: plan.activeOrder
        ? {
            id: plan.activeOrder.id,
            number: plan.activeOrder.number,
            bagStartPending: false,
            bagStartedAt: plan.bagStartedAt?.toISOString() ?? null,
          }
        : null,
    };
  }

  @Post('replenishment-plans/:id/reorder-cart')
  public async reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: ReorderMobileCartDto,
  ) {
    const customerId = (await this.customers.findByUserId(user.userId)).id;
    const plan = this.plans.assertReorderable(
      await this.plans.find(id, { customerId }),
    );
    const cart = await this.carts.reorder(
      { customerId, source: 'MOBILE' },
      plan.variantId,
      { role: 'MAIN', petId: plan.petId, planId: plan.id },
      input.quantity,
    );
    return {
      ...toMobileCart(cart),
      ...('cartToken' in cart && cart.cartToken
        ? { cartToken: cart.cartToken }
        : {}),
    };
  }
}

const daysForBucket = (bucket: string, durationDays: number): number => {
  if (bucket === 'FEW_DAYS') return 3;
  if (bucket === 'ABOUT_WEEK') return 7;
  if (bucket === 'MORE_THAN_WEEK') return 14;
  const fractions: Record<string, number> = {
    ALMOST_FULL: 0.9,
    MORE_THAN_HALF: 0.7,
    ABOUT_HALF: 0.5,
    ALMOST_EMPTY: 0.15,
    FINISHED: 0,
  };
  const fraction = fractions[bucket] ?? 0;
  return Math.max(0, Math.round(durationDays * fraction));
};
