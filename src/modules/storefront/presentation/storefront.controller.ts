import {
  Controller,
  Get,
  Header,
  Headers,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { OptionalAuthGuard } from '../../auth/presentation/guards/optional-auth.guard';
import type { AuthenticatedRequest } from '../../auth/presentation/authenticated-user';
import { AccountQueryService } from '../application/account-query.service';
import { StorefrontQueryService } from '../application/storefront-query.service';
import { AccountScreenQueryDto } from './storefront.dto';
import {
  AccountScreenResponseDto,
  CartScreenResponseDto,
  StorefrontShellResponseDto,
} from './storefront-response.dto';

@ApiTags('Public storefront')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Cart-Token', required: false })
@UseGuards(OptionalAuthGuard)
@Controller('storefront')
export class StorefrontController {
  public constructor(private readonly storefront: StorefrontQueryService) {}

  @Get('bootstrap')
  @ApiOkResponse({ type: StorefrontShellResponseDto })
  @Header('Cache-Control', 'private, no-store')
  public bootstrap(
    @Req() request: Request,
    @Headers('x-cart-token') cartToken?: string,
  ) {
    return this.storefront.bootstrap({
      user: (request as Partial<AuthenticatedRequest>).user,
      cartToken,
    });
  }
}

@ApiTags('Customer account')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('me/account')
export class AccountController {
  public constructor(private readonly account: AccountQueryService) {}

  @Get()
  @ApiOkResponse({ type: AccountScreenResponseDto })
  @Header('Cache-Control', 'private, no-store')
  public screen(
    @Req() request: AuthenticatedRequest,
    @Query() query: AccountScreenQueryDto,
  ) {
    return this.account.getScreen({
      user: request.user,
      section: query.section,
      orderId: query.orderId,
      page: query.page,
      perPage: query.perPage,
    });
  }
}

@ApiTags('Customer cart')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Cart-Token', required: false })
@UseGuards(OptionalAuthGuard)
@Controller('cart')
export class CartScreenController {
  public constructor(private readonly storefront: StorefrontQueryService) {}

  @Get('bootstrap')
  @ApiOkResponse({ type: CartScreenResponseDto })
  @Header('Cache-Control', 'private, no-store')
  public bootstrap(
    @Req() request: Request,
    @Headers('x-cart-token') cartToken?: string,
  ) {
    return this.storefront.cartScreen({
      user: (request as Partial<AuthenticatedRequest>).user,
      cartToken,
    });
  }
}
