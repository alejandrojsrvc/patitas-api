import { Body, Controller, Get, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/presentation/authenticated-user';
import { UserRole } from '../../users/domain/entities/user.entity';
import { AdminAuditInterceptor } from '../../../infrastructure/audit/admin-audit.interceptor';
import { PaymentService } from '../application/payment.service';
import { ConfirmManualTransferDto } from './manual-transfer.dto';

@ApiTags('Admin manual transfers')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@Controller('admin/payment-method-benefits/transfers')
export class AdminManualTransferController {
  public constructor(private readonly payments: PaymentService) {}

  @Get()
  public list() {
    return this.payments.listPendingTransfers();
  }

  @Post(':attemptId/confirm')
  public confirm(@CurrentUser() user: AuthenticatedUser, @Param('attemptId') attemptId: string, @Body() input: ConfirmManualTransferDto) {
    return this.payments.confirmTransfer(attemptId, {
      ...input,
      actorUserId: user.userId,
    });
  }
}
