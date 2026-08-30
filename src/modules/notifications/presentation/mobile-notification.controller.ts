import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/presentation/authenticated-user';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { UserRole } from '../../users/domain/entities/user.entity';
import { CustomerService } from '../../customers/application/customer.service';
import { NotificationService } from '../application/notification.service';
import {
  RegisterMobileDeviceTokenDto,
  MobileNotificationsQueryDto,
  UpdateMobileNotificationPreferencesDto,
} from './mobile-notification.dto';

@ApiTags('Customer mobile communications')
@ApiBearerAuth()
@Roles(UserRole.CUSTOMER)
@UseGuards(AuthGuard, RolesGuard)
@Controller('mobile')
export class MobileNotificationController {
  public constructor(
    private readonly notifications: NotificationService,
    private readonly customers: CustomerService,
  ) {}

  @Get('communications/notification-preferences')
  public async getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.getMobilePreferences(await this.customerId(user));
  }

  @Patch('communications/notification-preferences')
  public async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: UpdateMobileNotificationPreferencesDto,
  ) {
    return this.notifications.updateMobilePreferences(
      await this.customerId(user),
      input,
    );
  }

  @Post('communications/device-tokens')
  public async registerDeviceToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: RegisterMobileDeviceTokenDto,
  ) {
    return this.notifications.registerMobileDeviceToken({
      customerId: await this.customerId(user),
      ...input,
    });
  }

  @Delete('communications/device-tokens/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async deleteDeviceToken(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.notifications.deactivateDeviceToken(
      await this.customerId(user),
      id,
    );
  }

  @Get('me/notifications')
  public async listNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MobileNotificationsQueryDto,
  ) {
    const result = await this.notifications.listInAppNotifications(
      await this.customerId(user),
      { unreadOnly: query.unreadOnly, cursor: query.cursor },
    );
    return {
      items: result.items.map(toMobileNotification),
      unreadCount: result.unreadCount,
      nextCursor: result.nextCursor,
    };
  }

  @Post('me/notifications/read-all')
  public async readAllNotifications(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.readAllInAppNotifications(
      await this.customerId(user),
    );
  }

  @Patch('me/notifications/:id/read')
  public async readNotification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return toMobileNotification(
      await this.notifications.readInAppNotification(
        await this.customerId(user),
        id,
      ),
    );
  }

  private customerId(user: AuthenticatedUser) {
    return this.customers
      .findByUserId(user.userId)
      .then((customer) => customer.id);
  }
}

const toMobileNotification = (notification: {
  id: string;
  type: string;
  title: string;
  body: string;
  targetType: string | null;
  targetId: string | null;
  readAt: Date | null;
  createdAt: Date;
}) => ({
  id: notification.id,
  type: notification.type,
  title: notification.title,
  body: notification.body,
  createdAt: notification.createdAt.toISOString(),
  readAt: notification.readAt?.toISOString() ?? null,
  target:
    notification.targetType && notification.targetId
      ? {
          type: notification.targetType.toLowerCase(),
          id: notification.targetId,
        }
      : null,
});
