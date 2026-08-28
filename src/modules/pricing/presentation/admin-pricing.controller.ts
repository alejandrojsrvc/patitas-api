import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { UserRole } from '../../users/domain/entities/user.entity';
import { AdminAuditInterceptor } from '../../../infrastructure/audit/admin-audit.interceptor';
import { PricingService } from '../application/pricing.service';
import type {
  OperatingCostInput,
  PaymentFeeScheduleInput,
} from '../domain/pricing.types';
import {
  ApplyPriceDto,
  BulkRecalculatePriceDto,
  CalculatePriceDto,
  CreateOperatingCostDto,
  CreatePaymentFeeScheduleDto,
  CreatePricingScenarioDto,
  PricingReviewsQueryDto,
  PricingRuleValuesDto,
  RecalculatePriceDto,
  UpdateOperatingCostDto,
  UpdatePaymentFeeScheduleDto,
  UpdatePricingScenarioDto,
} from './pricing.dto';
import type { PricingScenarioInput } from '../domain/pricing.types';
import { PricingExceptionFilter } from './pricing-exception.filter';

@ApiTags('Admin pricing')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@UseFilters(PricingExceptionFilter)
@Controller('admin')
export class AdminPricingController {
  public constructor(private readonly pricing: PricingService) {}

  @Get('pricing/rules') public rules() {
    return this.pricing.getRules();
  }
  @Get('pricing/rules/history')
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          version: { type: 'integer' },
          status: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          activatedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
    },
  })
  public ruleHistory() {
    return this.pricing.listRuleHistory();
  }
  @Patch('pricing/rules') public updateRules(
    @Body() input: PricingRuleValuesDto,
  ) {
    return this.pricing.updateDraft(input);
  }
  @Post('pricing/rules/activate') public activateRules() {
    return this.pricing.activateDraft();
  }
  @Post('pricing/calculate') public calculate(
    @Body() input: CalculatePriceDto,
  ) {
    return this.pricing.calculate(
      input.variantId,
      input.supplierOfferId,
      input.overrides,
      input.scenarioId,
    );
  }
  @Post('pricing/recalculate') public recalculateAll(
    @Body() input: BulkRecalculatePriceDto,
  ) {
    return this.pricing.recalculateAll(input.scenarioId);
  }
  @Post('variants/:id/recalculate-price') public recalculate(
    @Param('id') id: string,
    @Body() input: RecalculatePriceDto,
  ) {
    return this.pricing.recalculate(
      id,
      input.supplierOfferId,
      input.overrides,
      input.scenarioId,
    );
  }
  @Get('variants/:id/pricing-reviews') public reviews(@Param('id') id: string) {
    return this.pricing.listReviews(id);
  }
  @Get('pricing/reviews')
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object' } },
        meta: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            perPage: { type: 'integer' },
            total: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
      },
    },
  })
  public async allReviews(@Query() query: PricingReviewsQueryDto) {
    const page = await this.pricing.listAllReviews(query);
    return {
      items: page.items,
      meta: {
        page: page.page,
        perPage: page.perPage,
        total: page.total,
        totalPages: Math.ceil(page.total / page.perPage),
      },
    };
  }
  @Post('variants/:id/apply-price') public apply(
    @Param('id') id: string,
    @Body() input: ApplyPriceDto,
  ) {
    return this.pricing.apply(id, input.pricingReviewId, {
      activateProduct: input.activateProduct,
    });
  }

  @Get('pricing/payment-fees')
  public paymentFeeSchedules(@Query('active') active?: string) {
    return this.pricing.listPaymentFeeSchedules(
      active === undefined ? undefined : active === 'true',
    );
  }

  @Post('pricing/payment-fees')
  public createPaymentFeeSchedule(@Body() input: CreatePaymentFeeScheduleDto) {
    return this.pricing.createPaymentFeeSchedule(toPaymentFeeInput(input));
  }

  @Patch('pricing/payment-fees/:id')
  public updatePaymentFeeSchedule(
    @Param('id') id: string,
    @Body() input: UpdatePaymentFeeScheduleDto,
  ) {
    return this.pricing.updatePaymentFeeSchedule(
      id,
      toPaymentFeeUpdateInput(input),
    );
  }

  @Post('pricing/payment-fees/:id/select')
  public selectPaymentFeeSchedule(@Param('id') id: string) {
    return this.pricing.selectPaymentFeeSchedule(id);
  }

  @Get('pricing/operating-costs')
  public operatingCosts(@Query('active') active?: string) {
    return this.pricing.listOperatingCosts(
      active === undefined ? undefined : active === 'true',
    );
  }

  @Post('pricing/operating-costs')
  public createOperatingCost(@Body() input: CreateOperatingCostDto) {
    return this.pricing.createOperatingCost(toOperatingCostInput(input));
  }

  @Patch('pricing/operating-costs/:id')
  public updateOperatingCost(
    @Param('id') id: string,
    @Body() input: UpdateOperatingCostDto,
  ) {
    return this.pricing.updateOperatingCost(
      id,
      toOperatingCostUpdateInput(input),
    );
  }

  @Get('pricing/scenarios')
  public pricingScenarios() {
    return this.pricing.listPricingScenarios();
  }

  @Post('pricing/scenarios')
  public createPricingScenario(@Body() input: CreatePricingScenarioDto) {
    return this.pricing.createPricingScenario(toPricingScenarioInput(input));
  }

  @Patch('pricing/scenarios/:id')
  public updatePricingScenario(
    @Param('id') id: string,
    @Body() input: UpdatePricingScenarioDto,
  ) {
    return this.pricing.updatePricingScenario(
      id,
      toPricingScenarioUpdateInput(input),
    );
  }

  @Get('pricing/scenarios/:id/analysis')
  public analyzePricingScenario(@Param('id') id: string) {
    return this.pricing.analyzePricingScenario(id);
  }
}

const toPaymentFeeInput = (input: CreatePaymentFeeScheduleDto) => ({
  ...input,
  effectiveFrom: input.effectiveFrom
    ? new Date(input.effectiveFrom)
    : new Date(),
  effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
});

const toPaymentFeeUpdateInput = (
  input: UpdatePaymentFeeScheduleDto,
): Partial<PaymentFeeScheduleInput> => {
  const { effectiveFrom, effectiveTo, ...rest } = input;
  return {
    ...rest,
    ...(effectiveFrom === undefined
      ? {}
      : { effectiveFrom: new Date(effectiveFrom) }),
    ...(effectiveTo === undefined
      ? {}
      : { effectiveTo: effectiveTo ? new Date(effectiveTo) : null }),
  };
};

const toOperatingCostInput = (input: CreateOperatingCostDto) => ({
  ...input,
  effectiveFrom: input.effectiveFrom
    ? new Date(input.effectiveFrom)
    : new Date(),
  effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
  amount: input.amount ?? null,
  percent: input.percent ?? null,
});

const toOperatingCostUpdateInput = (
  input: UpdateOperatingCostDto,
): Partial<OperatingCostInput> => {
  const { effectiveFrom, effectiveTo, ...rest } = input;
  return {
    ...rest,
    ...(effectiveFrom === undefined
      ? {}
      : { effectiveFrom: new Date(effectiveFrom) }),
    ...(effectiveTo === undefined
      ? {}
      : { effectiveTo: effectiveTo ? new Date(effectiveTo) : null }),
  };
};

const toPricingScenarioInput = (
  input: CreatePricingScenarioDto,
): PricingScenarioInput => ({
  name: input.name,
  periodStart: new Date(input.periodStart),
  periodEnd: new Date(input.periodEnd),
  ordersSource: input.ordersSource,
  projectedOrders: input.projectedOrders,
  averageItemsPerOrder: input.averageItemsPerOrder,
  paymentFeeScheduleId: input.paymentFeeScheduleId ?? null,
  active: input.active,
});

const toPricingScenarioUpdateInput = (
  input: UpdatePricingScenarioDto,
): Partial<PricingScenarioInput> => {
  const { periodStart, periodEnd, ...rest } = input;
  return {
    ...rest,
    ...(periodStart === undefined
      ? {}
      : { periodStart: new Date(periodStart) }),
    ...(periodEnd === undefined ? {} : { periodEnd: new Date(periodEnd) }),
  };
};
