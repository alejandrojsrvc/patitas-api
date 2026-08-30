import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import { OptionalAuthGuard } from '../../../auth/presentation/guards/optional-auth.guard';
import type { AuthenticatedUser } from '../../../auth/presentation/authenticated-user';
import { MobileCatalogService } from '../../application/mobile-catalog.service';
import { MobileCatalogQueryDto } from './mobile-catalog.dto';
import { MobileCursorPageResponseDto } from './mobile-catalog-response.dto';
import { toMobileOffer } from './mobile-catalog.mapper';

@ApiTags('Mobile offers')
@ApiBearerAuth()
@UseGuards(OptionalAuthGuard)
@Controller('mobile/offers')
export class MobileOffersController {
  public constructor(private readonly mobileCatalog: MobileCatalogService) {}

  @Get()
  @ApiOkResponse({ type: MobileCursorPageResponseDto })
  public list(
    @Query() query: MobileCatalogQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.mobileCatalog.listOffers(query, user?.userId).then((page) => ({
      ...page,
      items: page.items.map(toMobileOffer),
    }));
  }
}
