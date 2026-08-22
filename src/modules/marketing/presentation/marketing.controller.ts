import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { OptionalAuthGuard } from '../../auth/presentation/guards/optional-auth.guard';
import { CustomerService } from '../../customers/application/customer.service';
import { MarketingService } from '../application/marketing.service';

class MarketingEventDto { @IsIn(['Quiz_Completed', 'InitiateCheckout', 'Purchase']) public eventName!: 'Quiz_Completed' | 'InitiateCheckout' | 'Purchase'; @IsString() @MaxLength(160) public eventId!: string; @IsString() public source!: string; @IsOptional() @IsString() public value?: string; @IsOptional() @IsString() public currency?: string; @IsOptional() @IsObject() public payload?: Record<string, unknown>; @IsOptional() @IsString() public visitorHash?: string; @IsOptional() @IsString() public cartId?: string; @IsOptional() @IsString() public checkoutSessionId?: string; @IsOptional() @IsString() public orderId?: string; @IsOptional() @IsObject() public utm?: { source?: string; medium?: string; campaign?: string; content?: string }; @IsOptional() @IsString() public initialLanding?: string; }

@ApiTags('Marketing events')
@UseGuards(OptionalAuthGuard)
@Controller('marketing/events')
export class MarketingController {
  public constructor(private readonly marketing: MarketingService, private readonly customers: CustomerService) {}
  @Post() public async record(@Req() request: Request, @Body() input: MarketingEventDto) { const userId = (request as Request & { user?: { userId?: string } }).user?.userId; const customerId = userId ? (await this.customers.findByUserId(userId)).id : undefined; return this.marketing.record({ ...input, customerId }); }
}
