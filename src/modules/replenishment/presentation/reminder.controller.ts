import { Body, Controller, Get, Headers, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { OptionalAuthGuard } from '../../auth/presentation/guards/optional-auth.guard';
import type { AuthenticatedUser } from '../../auth/presentation/authenticated-user';
import { CustomerService } from '../../customers/application/customer.service';
import { hashAnonymousToken } from '../../../shared/application/anonymous-token';
import { NotificationService } from '../../notifications/application/notification.service';
import { ReplenishmentReminderService } from '../application/reminder.service';
import type { ReplenishmentReminderOwner } from '../domain/reminder.types';
import { CreateReplenishmentReminderDto, UpdateReplenishmentReminderStatusDto } from './reminder.dto';

@ApiTags('Replenishment reminders')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Replenishment-Token', required: false })
@UseGuards(OptionalAuthGuard)
@Controller('replenishment-reminders')
export class ReplenishmentReminderController {
  public constructor(
    private readonly reminders: ReplenishmentReminderService,
    private readonly notifications: NotificationService,
    private readonly customers: CustomerService,
  ) {}

  @Post()
  public async create(
    @Req() request: Request,
    @Headers('x-replenishment-token') token: string | undefined,
    @Body() input: CreateReplenishmentReminderDto,
  ) {
    const owner = await ownerFromRequest(request, this.customers, token);
    const reminder = await this.reminders.create({ ...input, owner });
    await this.notifications.recordConsent({
      ...(owner.customerId ? { customerId: owner.customerId } : {}),
      ...(owner.guestTokenHash ? { guestTokenHash: owner.guestTokenHash } : {}),
      channel: 'EMAIL',
      destination: input.email,
      version: input.consentVersion,
    });
    return {
      id: reminder.id,
      status: reminder.status,
      nextReminderAt: reminder.nextReminderAt,
    };
  }

  @Get()
  public async list(@Req() request: Request, @Headers('x-replenishment-token') token: string | undefined) {
    return this.reminders.list(await ownerFromRequest(request, this.customers, token));
  }

  @Patch(':id/status')
  public async status(
    @Req() request: Request,
    @Headers('x-replenishment-token') token: string | undefined,
    @Param('id') id: string,
    @Body() input: UpdateReplenishmentReminderStatusDto,
  ) {
    return this.reminders.setStatus(id, await ownerFromRequest(request, this.customers, token), input.status);
  }
}

const ownerFromRequest = async (request: Request, customers: CustomerService, token?: string): Promise<ReplenishmentReminderOwner> => {
  const user = (request as Request & { user?: AuthenticatedUser }).user;
  if (user) return { customerId: (await customers.findByUserId(user.userId)).id };
  return token ? { guestTokenHash: hashAnonymousToken(token) } : {};
};
