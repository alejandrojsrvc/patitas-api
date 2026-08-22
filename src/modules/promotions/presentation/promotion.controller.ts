import { Body, Controller, Get, Param, Patch, Post, Query, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { UserRole } from '../../users/domain/entities/user.entity';
import { PromotionService } from '../application/promotion.service';
import { CreateCouponDto, CreatePromotionDto, UpdateCouponDto, UpdatePromotionDto } from './promotion.dto';
import { PromotionExceptionFilter } from './promotion.exception.filter';
import { AdminAuditInterceptor } from '../../../infrastructure/audit/admin-audit.interceptor';

@ApiTags('Promotions')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@UseFilters(PromotionExceptionFilter)
@Controller('admin')
export class PromotionController {
  public constructor(private readonly promotions: PromotionService) {}
  @Get('promotions') public list(@Query('active') active?: string) { return this.promotions.list(active === 'true'); }
  @Get('promotions/:id') public find(@Param('id') id: string) { return this.promotions.find(id); }
  @Post('promotions') public create(@Body() input: CreatePromotionDto) { return this.promotions.create(input); }
  @Patch('promotions/:id') public update(@Param('id') id: string, @Body() input: UpdatePromotionDto) { return this.promotions.update(id, input); }
  @Get('coupons') public coupons() { return this.promotions.listCoupons(); }
  @Post('coupons') public createCoupon(@Body() input: CreateCouponDto) { return this.promotions.createCoupon(input); }
  @Patch('coupons/:id') public updateCoupon(@Param('id') id: string, @Body() input: UpdateCouponDto) { return this.promotions.updateCoupon(id, input); }
}
