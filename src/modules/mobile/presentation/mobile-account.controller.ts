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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../../users/domain/entities/user.entity';
import type { AuthenticatedUser } from '../../auth/presentation/authenticated-user';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { CustomerAddressService } from '../../customers/application/customer-address.service';
import { CustomerService } from '../../customers/application/customer.service';
import {
  MobileAddressCreateDto,
  MobileAddressUpdateDto,
  MobileCustomerUpdateDto,
} from './mobile.dto';
import {
  toMobileAddress,
  toMobileCustomer,
  toMobileUser,
} from './mobile.mapper';

@ApiTags('Mobile account')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
@Controller('mobile')
export class MobileAccountController {
  public constructor(
    private readonly customers: CustomerService,
    private readonly addresses: CustomerAddressService,
  ) {}

  @Get('me')
  public async me(@CurrentUser() user: AuthenticatedUser) {
    return toMobileUser(
      { id: user.userId, email: user.email, role: user.role },
      await this.customers.findProfileByUserId(user.userId),
    );
  }

  @Get('me/customer')
  public async customer(@CurrentUser() user: AuthenticatedUser) {
    return toMobileCustomer(
      await this.customers.findProfileByUserId(user.userId),
    );
  }

  @Patch('me/customer')
  public async updateCustomer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: MobileCustomerUpdateDto,
  ) {
    return toMobileCustomer(
      await this.customers.updateProfileByUserId(user.userId, input),
    );
  }

  @Get('me/addresses')
  public async listAddresses(@CurrentUser() user: AuthenticatedUser) {
    return (await this.addresses.listForUser(user.userId)).map(toMobileAddress);
  }

  @Post('me/addresses')
  @HttpCode(HttpStatus.CREATED)
  public async createAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: MobileAddressCreateDto,
  ) {
    return toMobileAddress(
      await this.addresses.createForUser(user.userId, input),
    );
  }

  @Patch('me/addresses/:id')
  public async updateAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: MobileAddressUpdateDto,
  ) {
    return toMobileAddress(
      await this.addresses.updateForUser(user.userId, id, input),
    );
  }

  @Delete('me/addresses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async deleteAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.addresses.deleteForUser(user.userId, id);
  }
}
