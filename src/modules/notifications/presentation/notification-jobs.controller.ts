import {
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { NotificationService } from '../application/notification.service';

@ApiTags('Internal jobs')
@Controller('internal/jobs')
export class NotificationJobsController {
  public constructor(
    private readonly notifications: NotificationService,
    private readonly config: ConfigService,
  ) {}
  @Post('abandoned-carts')
  @ApiHeader({ name: 'X-Cron-Secret', required: true })
  public abandoned(@Headers('x-cron-secret') secret?: string) {
    if (!secret || secret !== this.config.get<string>('CRON_SECRET'))
      throw new UnauthorizedException();
    return this.notifications.processAbandonedCarts(
      Number(this.config.get<string>('ABANDONED_CART_WINDOW_MINUTES', '120')),
    );
  }
  @Post('replenishment-reminders')
  public reminders(@Headers('x-cron-secret') secret?: string) {
    if (!secret || secret !== this.config.get<string>('CRON_SECRET'))
      throw new UnauthorizedException();
    return this.notifications.processPlanReminders();
  }
}
