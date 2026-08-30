import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import { OptionalAuthGuard } from '../../../auth/presentation/guards/optional-auth.guard';
import type { AuthenticatedUser } from '../../../auth/presentation/authenticated-user';
import { MobileCatalogService } from '../../application/mobile-catalog.service';
import { MobileCatalogQueryDto } from './mobile-catalog.dto';
import {
  MobileCursorPageResponseDto,
  MobileProductResponseDto,
} from './mobile-catalog-response.dto';
import { toMobileProduct } from './mobile-catalog.mapper';

@ApiTags('Mobile products')
@ApiBearerAuth()
@UseGuards(OptionalAuthGuard)
@Controller('mobile/products')
export class MobileProductsController {
  public constructor(private readonly mobileCatalog: MobileCatalogService) {}

  @Get()
  @ApiOkResponse({ type: MobileCursorPageResponseDto })
  public list(
    @Query() query: MobileCatalogQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.mobileCatalog
      .listProducts(query, user?.userId)
      .then((page) => ({
        ...page,
        items: page.items.map((item) =>
          toMobileProduct(item.product, item.shippingQuotes),
        ),
      }));
  }

  @Get(':slug')
  @ApiOkResponse({ type: MobileProductResponseDto })
  public product(
    @Param('slug') slug: string,
    @Query() query: MobileCatalogQueryDto,
  ) {
    return this.mobileCatalog
      .getProduct(slug, query)
      .then((item) => toMobileProduct(item.product, item.shippingQuotes));
  }
}
