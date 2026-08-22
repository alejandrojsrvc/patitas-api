import {
  Body,
  Controller,
  Param,
  Post,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { UserRole } from '../../users/domain/entities/user.entity';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/presentation/authenticated-user';
import { AdminAuditInterceptor } from '../../../infrastructure/audit/admin-audit.interceptor';
import { InventoryService } from '../application/inventory.service';
import { InventoryAdjustmentDto, InventoryQueryDto } from './inventory.dto';

@ApiTags('Admin inventory')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@Controller('admin')
export class InventoryController {
  public constructor(private readonly inventory: InventoryService) {}
  @Get('inventory')
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
  public async list(@Query() query: InventoryQueryDto) {
    const page = await this.inventory.list(query);
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
  @Post('variants/:variantId/inventory/adjustments')
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        variantId: { type: 'string', format: 'uuid' },
        onHand: { type: 'integer' },
        reserved: { type: 'integer' },
        available: { type: 'integer' },
      },
    },
  })
  public adjust(
    @Param('variantId') variantId: string,
    @Body() input: InventoryAdjustmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.adjust({ ...input, variantId }, user.userId);
  }
}
