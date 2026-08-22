import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/presentation/authenticated-user';
import { CustomerService } from '../../customers/application/customer.service';
import { ReferralService } from '../application/referral.service';
import { AttributeReferralDto, CreateReferralCampaignDto, CreateReferralCodeDto } from './referral.dto';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { UserRole } from '../../users/domain/entities/user.entity';

@ApiTags('Customer referrals')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('me/referrals')
export class ReferralController {
  public constructor(private readonly referrals: ReferralService, private readonly customers: CustomerService) {}
  @Get() public async mine(@CurrentUser() user: AuthenticatedUser) { return this.referrals.mine((await this.customers.findByUserId(user.userId)).id); }
  @Post('codes') public async code(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateReferralCodeDto) { return this.referrals.createCode((await this.customers.findByUserId(user.userId)).id, input.campaignId); }
  @Post('attribute') public async attribute(@CurrentUser() user: AuthenticatedUser, @Body() input: AttributeReferralDto) { return this.referrals.attribute(input.code, (await this.customers.findByUserId(user.userId)).id); }
}

@ApiTags('Admin referrals')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
@Controller('admin/referral-campaigns')
export class AdminReferralController {
  public constructor(private readonly referrals: ReferralService) {}
  @Post() public create(@Body() input: CreateReferralCampaignDto) { return this.referrals.createCampaign(input); }
}
