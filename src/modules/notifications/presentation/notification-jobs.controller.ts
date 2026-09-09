import { Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
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
    if (!secret || secret !== this.config.get<string>('CRON_SECRET')) throw new UnauthorizedException();
    return this.notifications.processAbandonedCarts(Number(this.config.get<string>('ABANDONED_CART_WINDOW_MINUTES', '120')));
  }
  @Post('replenishment-reminders')
  public async reminders(@Headers('x-cron-secret') secret?: string) {
    if (!secret || secret !== this.config.get<string>('CRON_SECRET')) throw new UnauthorizedException();
    const [plans, subscriptions, schedules] = await Promise.all([
      this.notifications.processPlanReminders(),
      this.notifications.processReminderSubscriptions(),
      this.notifications.processPurchaseScheduleReminders(),
    ]);
    return {
      scanned: plans.scanned + subscriptions.scanned + schedules.scanned,
      notified: plans.notified + subscriptions.notified + schedules.notified,
      plans,
      subscriptions,
      schedules,
    };
  }
}
