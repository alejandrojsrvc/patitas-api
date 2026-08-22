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
import {
  ApplyPriceDto,
  CalculatePriceDto,
  PricingReviewsQueryDto,
  PricingRuleValuesDto,
  RecalculatePriceDto,
} from './pricing.dto';
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
    );
  }
  @Post('variants/:id/recalculate-price') public recalculate(
    @Param('id') id: string,
    @Body() input: RecalculatePriceDto,
  ) {
    return this.pricing.recalculate(id, input.overrides);
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
    return this.pricing.apply(id, input.pricingReviewId);
  }
}
