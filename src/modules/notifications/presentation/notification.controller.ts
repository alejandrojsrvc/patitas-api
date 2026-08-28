import {
  Body,
  Controller,
  Get,
  Headers,
  Patch,
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
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { OptionalAuthGuard } from '../../auth/presentation/guards/optional-auth.guard';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { CustomerService } from '../../customers/application/customer.service';
import { hashAnonymousToken } from '../../../shared/application/anonymous-token';
import { NotificationService } from '../application/notification.service';

class PreferencesDto {
  @ApiProperty() @IsIn([true, false]) public push!: boolean;
  @ApiProperty() @IsIn([true, false]) public email!: boolean;
  @ApiProperty() @IsIn([true, false]) public whatsapp!: boolean;
}
class DeviceTokenDto {
  @ApiProperty() @IsString() @MaxLength(500) public token!: string;
  @ApiProperty({ enum: ['ios', 'android'] })
  @IsIn(['ios', 'android'])
  public platform!: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  public appVersion?: string;
}

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
  @Patch('notification-preferences')
  @UseGuards(AuthGuard)
  public async preferences(
    @Req() request: Request,
    @Body() input: PreferencesDto,
  ) {
    const customerId = await authenticatedCustomerId(request, this.customers);
    return this.notifications.updatePreferences(customerId, input);
  }
  @Get('notification-preferences')
  @UseGuards(AuthGuard)
  public async getPreferences(@Req() request: Request) {
    return this.notifications.getPreferences(
      await authenticatedCustomerId(request, this.customers),
    );
  }
  @Post('device-tokens')
  @UseGuards(AuthGuard)
  public async deviceToken(
    @Req() request: Request,
    @Body() input: DeviceTokenDto,
  ) {
    await this.notifications.registerDeviceToken({
      customerId: await authenticatedCustomerId(request, this.customers),
      ...input,
    });
    return { registered: true };
  }
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

const authenticatedCustomerId = async (
  request: Request,
  customers: CustomerService,
) => {
  const userId = (request as Request & { user?: { userId: string } }).user
    ?.userId;
  if (!userId) throw new Error('Se requiere autenticación.');
  return (await customers.findByUserId(userId)).id;
};

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
