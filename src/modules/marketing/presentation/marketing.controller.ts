import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import type { Request } from 'express';
import { OptionalAuthGuard } from '../../auth/presentation/guards/optional-auth.guard';
import { CustomerService } from '../../customers/application/customer.service';
import { MarketingService } from '../application/marketing.service';

class MarketingUtmDto {
  @IsOptional() @IsString() @MaxLength(200) public source?: string;
  @IsOptional() @IsString() @MaxLength(200) public medium?: string;
  @IsOptional() @IsString() @MaxLength(300) public campaign?: string;
  @IsOptional() @IsString() @MaxLength(300) public content?: string;
}

class MarketingEventDto {
  @IsIn(['Quiz_Completed', 'InitiateCheckout']) public eventName!: 'Quiz_Completed' | 'InitiateCheckout';
  @IsString() @MaxLength(160) public eventId!: string;
  @IsIn(['web', 'mobile']) public source!: 'web' | 'mobile';
  @IsOptional() @IsString() @MaxLength(32) public value?: string;
  @IsOptional() @IsString() @MaxLength(3) public currency?: string;
  @IsOptional() @IsObject() public payload?: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(160) public visitorHash?: string;
  @IsOptional() @IsString() @MaxLength(160) public cartId?: string;
  @IsOptional() @IsString() @MaxLength(160) public checkoutSessionId?: string;
  @IsOptional() @IsString() @MaxLength(160) public orderId?: string;
  @IsOptional() @ValidateNested() @Type(() => MarketingUtmDto) public utm?: MarketingUtmDto;
  @IsOptional() @IsString() @MaxLength(2_048) public initialLanding?: string;
}

@ApiTags('Marketing events')
@UseGuards(OptionalAuthGuard)
@Controller('marketing/events')
export class MarketingController {
  public constructor(
    private readonly marketing: MarketingService,
    private readonly customers: CustomerService,
  ) {}
  @Post() public async record(@Req() request: Request, @Body() input: MarketingEventDto) {
    const userId = (request as Request & { user?: { userId?: string } }).user?.userId;
    const customerId = userId ? (await this.customers.findByUserId(userId)).id : undefined;
    return this.marketing.record({ ...input, customerId });
  }
}
