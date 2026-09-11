import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { UserRole } from '../../users/domain/entities/user.entity';
import { NotificationService } from '../application/notification.service';

@ApiTags('Admin notifications')
@ApiBearerAuth()
@Controller('admin/notifications')
@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
export class AdminNotificationController {
  public constructor(private readonly notifications: NotificationService) {}
  @Post('orders/:orderId/confirmation/retry') public retry(@Param('orderId') orderId: string) {
    return this.notifications.retryOrderConfirmation(orderId);
  }
}
