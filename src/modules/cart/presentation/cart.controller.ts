import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseFilters, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { hashAnonymousToken } from '../../../shared/application/anonymous-token';
import { OptionalAuthGuard } from '../../auth/presentation/guards/optional-auth.guard';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { CustomerService } from '../../customers/application/customer.service';
import { CartService } from '../application/cart.service';
import { MergeCartDto, SetCartItemDto } from './cart.dto';
import { CartExceptionFilter } from './cart.exception.filter';
import { CartValidationError } from '../domain/cart.error';

@ApiTags('Customer cart')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Cart-Token', required: false })
@UseGuards(OptionalAuthGuard)
@UseFilters(CartExceptionFilter)
@Controller('cart')
export class CartController {
  public constructor(private readonly carts: CartService, private readonly customers: CustomerService) {}

  @Post() public async create(@Req() request: Request) {
    const result = await this.carts.getOrCreate(await ownerFromRequest(request, this.customers));
    return { ...result.cart, ...(result.token ? { cartToken: result.token } : {}) };
  }
  @Get() public async current(@Req() request: Request) {
    const result = await this.carts.getOrCreate(await ownerFromRequest(request, this.customers));
    return { ...result.cart, ...(result.token ? { cartToken: result.token } : {}) };
  }
  @Put('items/:variantId') public async setItem(@Req() request: Request, @Param('variantId') variantId: string, @Body() input: SetCartItemDto) {
    return this.carts.setItem(await ownerFromRequest(request, this.customers), variantId, input.quantity);
  }
  @Delete('items/:variantId') public async removeItem(@Req() request: Request, @Param('variantId') variantId: string) {
    return this.carts.removeItem(await ownerFromRequest(request, this.customers), variantId);
  }
  @Post('merge')
  @UseGuards(AuthGuard)
  public merge(@Req() request: Request, @Body() input: MergeCartDto) {
    const userId = (request as Request & { user?: { userId: string } }).user?.userId;
    if (!userId) throw new CartValidationError('Se requiere una sesión de cliente.');
    return this.customers.findByUserId(userId).then((customer) => this.carts.merge(input.cartToken, customer.id));
  }
}

const ownerFromRequest = async (request: Request, customers: CustomerService) => {
  const userId = (request as Request & { user?: { userId: string } }).user?.userId;
  const token = request.headers['x-cart-token'];
  if (userId) return { customerId: (await customers.findByUserId(userId)).id };
  return typeof token === 'string' ? { tokenHash: hashAnonymousToken(token) } : {};
};
