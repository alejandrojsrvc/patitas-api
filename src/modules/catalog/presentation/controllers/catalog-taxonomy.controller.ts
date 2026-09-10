import { Controller, Get, Header, Query, UseFilters } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CatalogTaxonomyService } from '../../application/catalog-taxonomy.service';
import { CatalogExceptionFilter } from '../filters/catalog-exception.filter';
import { CatalogTaxonomyResolveQueryDto } from '../dto/catalog-taxonomy.dto';

@ApiTags('Catalog taxonomy')
@UseFilters(CatalogExceptionFilter)
@Controller('catalog/taxonomy')
export class CatalogTaxonomyController {
  public constructor(private readonly taxonomy: CatalogTaxonomyService) {}

  @Get('resolve')
  @ApiOkResponse({ description: 'Landing indexable o redirect canónico.' })
  @Header('Cache-Control', 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400')
  public resolve(@Query() query: CatalogTaxonomyResolveQueryDto) {
    return this.taxonomy.resolveCatalogPath(query.path);
  }

  @Get('landings')
  @ApiOkResponse({ description: 'Manifiesto de landings SEO indexables.' })
  @Header('Cache-Control', 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400')
  public async landings() {
    return { items: await this.taxonomy.listIndexableLandings() };
  }
}
