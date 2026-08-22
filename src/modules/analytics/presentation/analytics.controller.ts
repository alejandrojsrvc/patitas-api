import { Controller, Get, Headers, Param, Post, Query, Req, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { OptionalAuthGuard } from '../../auth/presentation/guards/optional-auth.guard';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { UserRole } from '../../users/domain/entities/user.entity';
import { hashAnonymousToken } from '../../../shared/application/anonymous-token';
import { AnalyticsService } from '../application/analytics.service';
import { AdminAuditInterceptor } from '../../../infrastructure/audit/admin-audit.interceptor';
import { CatalogExceptionFilter } from '../../catalog/presentation/filters/catalog-exception.filter';

@ApiTags('Product analytics')
@ApiHeader({ name: 'X-Visitor-Id', required: false })
@UseGuards(OptionalAuthGuard)
@UseFilters(CatalogExceptionFilter)
@Controller()
export class PublicAnalyticsController {
  public constructor(private readonly analytics: AnalyticsService) {}
  @Post('products/:slug/view') public view(@Param('slug') slug: string, @Headers('x-visitor-id') visitorId: string | undefined, @Req() request: Request) {
    const userId = (request as Request & { user?: { userId: string } }).user?.userId;
    const key = hashAnonymousToken(userId ?? visitorId ?? `${request.ip}:${request.headers['user-agent'] ?? ''}`);
    return this.analytics.recordProductView(slug, key, userId);
  }
  @Get('recently-viewed') public recentlyViewed(@Headers('x-visitor-id') visitorId: string | undefined, @Req() request: Request) {
    const userId = (request as Request & { user?: { userId: string } }).user?.userId;
    const key = hashAnonymousToken(userId ?? visitorId ?? `${request.ip}:${request.headers['user-agent'] ?? ''}`);
    return this.analytics.recentlyViewed(key);
  }
}

@ApiTags('Admin product analytics')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@UseFilters(CatalogExceptionFilter)
@Controller('admin/products')
export class AdminAnalyticsController {
  public constructor(private readonly analytics: AnalyticsService) {}
  @Get(':id/views') public views(@Param('id') id: string, @Query('from') from?: string, @Query('to') to?: string) { return this.analytics.productStats(id, from, to); }
}
