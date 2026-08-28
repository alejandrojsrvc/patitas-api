import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/presentation/authenticated-user';
import { CustomerService } from '../../customers/application/customer.service';
import { PetService } from '../../pets/application/pet.service';
import { EstimateService } from '../application/estimate.service';
import {
  ReplenishmentService,
  ReplenishmentValidationError,
} from '../application/replenishment.service';
import { CheckoutHandoffService } from '../../checkout/application/checkout-handoff.service';
import type {
  ReplenishmentPlan,
  NotificationChannel,
} from '../domain/replenishment.types';
import {
  CreateMobileReplenishmentPlanDto,
  RecalibrateMobileReplenishmentPlanDto,
  UpdateMobileReplenishmentPlanDto,
} from './mobile-replenishment.dto';

@ApiTags('Customer mobile replenishment')
@ApiBearerAuth()
@ApiHeader({ name: 'Idempotency-Key', required: false })
@UseGuards(AuthGuard)
@Controller('me/replenishment-plans')
export class MobileReplenishmentController {
  public constructor(
    private readonly plans: ReplenishmentService,
    private readonly estimates: EstimateService,
    private readonly pets: PetService,
    private readonly customers: CustomerService,
    private readonly handoffs: CheckoutHandoffService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  public async list(@CurrentUser() user: AuthenticatedUser) {
    const customer = await this.customers.findByUserId(user.userId);
    return (await this.plans.list({ customerId: customer.id })).map(
      toMobilePlan,
    );
  }

  @Post()
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
    const channels = [
      ...new Set(input.reminderChannels),
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
        consentVersion: 'mobile-v1',
        destination: customer.email,
      },
      { customerId: customer.id },
    );
    const reminderAt = new Date(estimate.estimatedDepletionDate);
    reminderAt.setUTCDate(reminderAt.getUTCDate() - input.leadDays);
    const scheduled = await this.plans.updateSchedule(
      plan.id,
      { customerId: customer.id },
      reminderAt,
    );
    return toMobilePlan(scheduled);
  }

  @Patch(':planId')
  public async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId') id: string,
    @Body() input: UpdateMobileReplenishmentPlanDto,
  ) {
    const customerId = (await this.customers.findByUserId(user.userId)).id;
    let plan = await this.plans.find(id, { customerId });
    if (input.status)
      plan = await this.plans.setStatus(id, { customerId }, input.status);
    if (input.nextReminderAt)
      plan = await this.plans.updateSchedule(
        id,
        { customerId },
        new Date(input.nextReminderAt),
      );
    return toMobilePlan(plan);
  }

  @Post(':planId/recalibrate')
  public async recalibrate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId') id: string,
    @Body() input: RecalibrateMobileReplenishmentPlanDto,
  ) {
    const customerId = (await this.customers.findByUserId(user.userId)).id;
    const days =
      input.bucket === 'FEW_DAYS' ? 3 : input.bucket === 'ABOUT_WEEK' ? 7 : 14;
    return toMobilePlan(await this.plans.recalibrate(id, { customerId }, days));
  }

  @Post(':planId/reorder')
  public async reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId') id: string,
  ) {
    const customerId = (await this.customers.findByUserId(user.userId)).id;
    const plan = await this.plans.find(id, { customerId });
    const cart = await this.plans.reorder(
      id,
      { customerId },
      { anonymousToken: true },
    );
    const handoff = await this.handoffs.create(cart.cartId);
    const baseUrl = this.config
      .get<string>('PUBLIC_WEB_URL', 'http://localhost:3000')
      .replace(/\/$/, '');
    return {
      checkoutUrl: `${baseUrl}/checkout/handoff/${handoff.token}`,
      expiresAt: handoff.expiresAt.toISOString(),
      total: plan.salePrice,
      currency: 'ARS',
      lines: [
        {
          name: plan.productName ?? 'Alimento',
          presentation: plan.presentation,
          quantity: 1,
          unitPrice: plan.salePrice,
        },
      ],
    };
  }
}

const toMobilePlan = (plan: ReplenishmentPlan) => ({
  id: plan.id,
  pet: {
    id: plan.petId,
    name: plan.petName,
    species: plan.petSpecies,
    weightKg: Number(plan.petWeightKg),
    lifeStage: plan.petLifeStage,
    breed: plan.petBreed,
  },
  food: {
    productId: plan.productId,
    variantId: plan.variantId,
    sku: plan.sku,
    name: plan.productName ?? plan.presentation ?? 'Alimento',
    presentation: plan.presentation,
    weightGrams: plan.weightGrams,
    custom: false,
    purchasable: true,
  },
  dailyGrams: {
    min: plan.dailyGramsMin ?? Number(plan.dailyConsumption),
    max: plan.dailyGramsMax ?? Number(plan.dailyConsumption),
  },
  durationDays: { min: plan.durationDaysMin, max: plan.durationDaysMax },
  source: plan.calculationSource,
  sourceLabel: plan.calculationSource,
  estimatedDepletionDate: plan.estimatedDepletionDate.toISOString(),
  nextReminderAt: plan.nextReminderAt?.toISOString() ?? null,
  status: plan.needsReview ? 'NEEDS_REVIEW' : plan.status,
  orderId: plan.orderId,
  reminderChannels: plan.reminderChannels,
  createdAt: plan.createdAt.toISOString(),
});
