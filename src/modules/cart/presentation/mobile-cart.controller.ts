import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { hashAnonymousToken } from '../../../shared/application/anonymous-token';
import { CustomerService } from '../../customers/application/customer.service';
import { OptionalAuthGuard } from '../../auth/presentation/guards/optional-auth.guard';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { UserRole } from '../../users/domain/entities/user.entity';
import { CartService } from '../application/cart.service';
import type { Cart } from '../domain/cart.types';
import { CartValidationError } from '../domain/cart.error';
import { toMobileCart } from './mobile-cart.mapper';
import { MergeMobileCartDto, SetMobileCartItemDto } from './mobile-cart.dto';
import { CartExceptionFilter } from './cart.exception.filter';

@ApiTags('Customer mobile cart')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Cart-Token', required: false })
@UseGuards(OptionalAuthGuard)
@UseFilters(CartExceptionFilter)
@Controller('mobile/cart')
export class MobileCartController {
  public constructor(
    private readonly carts: CartService,
    private readonly customers: CustomerService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async create(@Req() request: Request) {
    return this.present(
      await this.carts.getOrCreate(
        await ownerFromRequest(request, this.customers),
      ),
    );
  }

  @Get()
  public async current(@Req() request: Request) {
    const owner = await ownerFromRequest(request, this.customers);
    if (!owner.customerId && !owner.tokenHash) return null;
    const cart = await this.carts.findActive(owner);
    return cart ? toMobileCart(cart) : null;
  }

  @Put('items/:variantId')
  public async setItem(
    @Req() request: Request,
    @Param('variantId') variantId: string,
    @Body() input: SetMobileCartItemDto,
  ) {
    const context = input.context ?? {
      role: input.role,
      petId: input.petId,
      planId: input.planId,
    };
    const cart = await this.carts.setItem(
      await ownerFromRequest(request, this.customers),
      variantId,
      input.quantity,
      context,
    );
    return this.presentCartResult(cart);
  }

  @Delete('items/:variantId')
  public async removeItem(
    @Req() request: Request,
    @Param('variantId') variantId: string,
  ) {
    return this.presentCartResult(
      await this.carts.removeItem(
        await ownerFromRequest(request, this.customers),
        variantId,
      ),
    );
  }

  @Post('merge')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  public async merge(
    @Req() request: Request,
    @Body() input: MergeMobileCartDto,
  ) {
    const userId = (request as Request & { user?: { userId: string } }).user
      ?.userId;
    if (!userId)
      throw new CartValidationError('Se requiere una sesión de cliente.');
    const customer = await this.customers.findByUserId(userId);
    return toMobileCart(
      await this.carts.merge(input.cartToken, customer.id, 'MOBILE'),
    );
  }

  private present(result: { cart: Cart; token?: string }) {
    return {
      ...toMobileCart(result.cart),
      ...(result.token ? { cartToken: result.token } : {}),
    };
  }

  private presentCartResult(result: Cart & { cartToken?: string }) {
    return {
      ...toMobileCart(result),
      ...('cartToken' in result && result.cartToken
        ? { cartToken: result.cartToken }
        : {}),
    };
  }
}

const ownerFromRequest = async (
  request: Request,
  customers: CustomerService,
) => {
  const userId = (request as Request & { user?: { userId: string } }).user
    ?.userId;
  const token = request.headers['x-cart-token'];
  if (userId)
    return {
      customerId: (await customers.findByUserId(userId)).id,
      source: 'MOBILE' as const,
    };
  return typeof token === 'string'
    ? { tokenHash: hashAnonymousToken(token), source: 'MOBILE' as const }
    : { source: 'MOBILE' as const };
};
