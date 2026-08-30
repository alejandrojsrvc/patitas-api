import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { MobileCatalogService } from '../../application/mobile-catalog.service';
import { MobileCategoriesQueryDto } from './mobile-catalog.dto';
import { MobileCursorPageResponseDto } from './mobile-catalog-response.dto';
import { toMobileCategory } from './mobile-catalog.mapper';

@ApiTags('Mobile categories')
@Controller('mobile/categories')
export class MobileCategoriesController {
  public constructor(private readonly mobileCatalog: MobileCatalogService) {}

  @Get()
  @ApiOkResponse({ type: MobileCursorPageResponseDto })
  public async list(@Query() query: MobileCategoriesQueryDto) {
    const page = await this.mobileCatalog.listCategories(query);
    return { ...page, items: page.items.map(toMobileCategory) };
  }
}
