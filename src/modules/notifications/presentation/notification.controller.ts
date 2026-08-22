import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { IsIn, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { OptionalAuthGuard } from '../../auth/presentation/guards/optional-auth.guard';
import { CustomerService } from '../../customers/application/customer.service';
import { hashAnonymousToken } from '../../../shared/application/anonymous-token';
import { NotificationService } from '../application/notification.service';

class ConsentDto {
  @ApiProperty({ enum: ['EMAIL', 'WHATSAPP'] })
  @IsIn(['EMAIL', 'WHATSAPP'])
  public channel!: 'EMAIL' | 'WHATSAPP';
  @ApiProperty() @IsString() @MaxLength(320) public destination!: string;
  @ApiProperty() @IsString() @MaxLength(40) public version!: string;
}
class UnsubscribeDto {
  @ApiProperty({ enum: ['EMAIL', 'WHATSAPP'] })
  @IsIn(['EMAIL', 'WHATSAPP'])
  public channel!: 'EMAIL' | 'WHATSAPP';
}

@ApiTags('Communications')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Order-Token', required: false })
@UseGuards(OptionalAuthGuard)
@Controller('communications')
export class NotificationController {
  public constructor(
    private readonly notifications: NotificationService,
    private readonly customers: CustomerService,
  ) {}
  @Post('consents') public async consent(
    @Req() request: Request,
    @Headers('x-order-token') token: string | undefined,
    @Body() input: ConsentDto,
  ) {
    const owner = await ownerFromRequest(request, this.customers, token);
    return this.notifications.recordConsent({ ...owner, ...input });
  }
  @Post('unsubscribe') public async unsubscribe(
    @Req() request: Request,
    @Headers('x-order-token') token: string | undefined,
    @Body() input: UnsubscribeDto,
  ) {
    const owner = await ownerFromRequest(request, this.customers, token);
    return this.notifications.unsubscribe({ ...owner, channel: input.channel });
  }
}

const ownerFromRequest = async (
  request: Request,
  customers: CustomerService,
  token?: string,
) => {
  const userId = (request as Request & { user?: { userId: string } }).user
    ?.userId;
  return userId
    ? { customerId: (await customers.findByUserId(userId)).id }
    : { guestTokenHash: token ? hashAnonymousToken(token) : undefined };
};
