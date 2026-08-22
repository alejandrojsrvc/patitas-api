import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../database/generated/prisma/client';
import { AuthGuard } from '../../modules/auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../modules/auth/presentation/guards/roles.guard';
import { Roles } from '../../modules/auth/presentation/decorators/roles.decorator';
import { UserRole } from '../../modules/users/domain/entities/user.entity';
import { AdminAuditInterceptor } from './admin-audit.interceptor';
import { AuditLogsQueryDto } from './audit.dto';

@ApiTags('Admin audit')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@Controller('admin/audit-logs')
export class AuditController {
  public constructor(private readonly prisma: PrismaService) {}

  @Get()
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
  public async list(@Query() query: AuditLogsQueryDto) {
    const q = query.q?.trim();
    const where: Prisma.AdminAuditLogWhereInput = {
      ...(query.method ? { method: query.method.toUpperCase() } : {}),
      ...(query.statusCode ? { statusCode: query.statusCode } : {}),
      ...(q
        ? {
            OR: [
              { action: { contains: q, mode: 'insensitive' } },
              { path: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        id: item.id,
        actorUserId: item.actorUserId,
        action: item.action,
        method: item.method,
        path: item.path,
        statusCode: item.statusCode,
        metadata: item.metadata ?? {},
        createdAt: item.createdAt,
      })),
      meta: {
        page: query.page,
        perPage: query.perPage,
        total,
        totalPages: Math.ceil(total / query.perPage),
      },
    };
  }
}
