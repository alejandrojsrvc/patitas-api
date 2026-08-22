import { Body, Controller, Delete, Get, Param, Patch, Post, UseFilters, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/presentation/authenticated-user';
import { CustomerService } from '../application/customer.service';
import { CustomerAddressService } from '../application/customer-address.service';
import { CustomerExceptionFilter } from './customer.exception.filter';
import { CreateCustomerAddressDto, UpdateCustomerAddressDto } from './customer-address.dto';
import { UpdateOwnCustomerDto } from './customer.dto';

@ApiTags('Customer profile')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@UseFilters(CustomerExceptionFilter)
@Controller('me')
export class CustomerProfileController {
  public constructor(
    private readonly customers: CustomerService,
    private readonly addresses: CustomerAddressService,
  ) {}

  @Get('customer') public profile(@CurrentUser() user: AuthenticatedUser) {
    return this.customers.findByUserId(user.userId);
  }
  @Patch('customer') public update(@CurrentUser() user: AuthenticatedUser, @Body() input: UpdateOwnCustomerDto) {
    return this.customers.updateByUserId(user.userId, input);
  }
  @Get('addresses') public listAddresses(@CurrentUser() user: AuthenticatedUser) {
    return this.addresses.listForUser(user.userId);
  }
  @Post('addresses') public createAddress(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateCustomerAddressDto) {
    return this.addresses.createForUser(user.userId, input);
  }
  @Patch('addresses/:id') public updateAddress(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() input: UpdateCustomerAddressDto) {
    return this.addresses.updateForUser(user.userId, id, input);
  }
  @Delete('addresses/:id') public deleteAddress(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.addresses.deleteForUser(user.userId, id);
  }
}
