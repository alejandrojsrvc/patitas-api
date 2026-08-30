import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminAuditInterceptor } from '../../../../infrastructure/audit/admin-audit.interceptor';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import { UserRole } from '../../../users/domain/entities/user.entity';
import { CatalogService } from '../../application/catalog.service';
import {
  AdminProductsQueryDto,
  BrandReferenceDto,
  CreateProductDto,
  CreateVariantDto,
  ReferenceDto,
  CreateProductMediaDto,
  FeedingGuideEntryDto,
  ReplaceFeedingGuideDto,
  SetInventoryDto,
  UpdateProductDto,
  UpdateReferenceDto,
  UpdateVariantDto,
  UpdateBrandReferenceDto,
  UpdateProductMediaDto,
  UploadProductMediaDto,
} from '../dto/catalog.dto';
import { CatalogExceptionFilter } from '../filters/catalog-exception.filter';
import { csv } from '../../../../shared/application/csv';

@ApiTags('Admin catalog')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@UseFilters(CatalogExceptionFilter)
@Controller('admin')
export class AdminCatalogController {
  public constructor(private readonly catalog: CatalogService) {}

  @Get('products/export-csv')
  @ApiProduces('text/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="products.csv"')
  public async exportProducts() {
    const products = await this.catalog.listAllAdminProducts();
    return csv(
      [
        'product_id', 'name', 'slug', 'description', 'brand_id', 'brand_name',
        'category_id', 'category_name', 'species', 'line', 'life_stage',
        'breed_size', 'status', 'variant_id', 'sku', 'barcode', 'presentation',
        'weight_grams', 'sale_price', 'compare_at_price', 'variant_active',
        'on_hand', 'reserved', 'available_quantity', 'preferred_supplier_offer_id',
      ],
      products.flatMap((product) => product.variants.map((variant) => [
        product.id, product.name, product.slug, product.description,
        product.brandId, product.brand.name, product.categoryId,
        product.category?.name, product.species, product.line, product.lifeStage,
        product.breedSize, product.status, variant.id, variant.sku,
        variant.barcode, variant.presentation, variant.weightGrams,
        variant.salePrice, variant.compareAtPrice, variant.active,
        variant.onHand ?? 0, variant.reserved ?? 0, variant.availableQuantity,
        variant.preferredSupplierOfferId,
      ])),
    );
  }

  @Get('products') public async products(
    @Query() query: AdminProductsQueryDto,
  ) {
    const page = await this.catalog.listAdminProducts(query);
    return {
      items: page.items,
      meta: {
        page: page.page,
        perPage: page.perPage,
        total: page.total,
        totalPages: Math.ceil(page.total / page.perPage),
      },
    };
  }
  @Get('products/:id') public product(@Param('id') id: string) {
    return this.catalog.getAdminProduct(id);
  }
  @Post('products') public createProduct(@Body() input: CreateProductDto) {
    return this.catalog.createProduct(input);
  }
  @Post('products/import-csv')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        publish: { type: 'boolean', default: false },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }),
  )
  public importCsv(
    @UploadedFile() file: UploadedProductImage | undefined,
    @Body('publish') publish?: string | boolean,
  ) {
    if (!file) throw new BadRequestException('Se requiere un archivo CSV.');
    return this.catalog.importSimpleCatalogCsv(file.buffer, {
      publish: publish === true || publish === 'true',
    });
  }
  @Patch('products/:id') public updateProduct(
    @Param('id') id: string,
    @Body() input: UpdateProductDto,
  ) {
    return this.catalog.updateProduct(id, input);
  }
  @Post('products/:id/variants') public createVariant(
    @Param('id') id: string,
    @Body() input: CreateVariantDto,
  ) {
    return this.catalog.createVariant(id, input);
  }
  @Patch('variants/:id') public updateVariant(
    @Param('id') id: string,
    @Body() input: UpdateVariantDto,
  ) {
    return this.catalog.updateVariant(id, input);
  }
  @Post('products/:id/media') public createMedia(
    @Param('id') id: string,
    @Body() input: CreateProductMediaDto,
  ) {
    return this.catalog.createProductMedia(id, input);
  }
  @Post('products/:id/media/upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        altText: { type: 'string', maxLength: 300 },
        variantId: { type: 'string', format: 'uuid', nullable: true },
        displayOrder: { type: 'integer', minimum: 0, default: 0 },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  public uploadMedia(
    @Param('id') id: string,
    @UploadedFile() file: UploadedProductImage | undefined,
    @Body() input: UploadProductMediaDto,
  ) {
    if (!file) {
      throw new BadRequestException('Se requiere un archivo de imagen.');
    }

    return this.catalog.uploadProductMedia(id, {
      variantId: input.variantId ?? null,
      altText: input.altText ?? null,
      displayOrder: input.displayOrder ?? 0,
      originalName: file.originalname,
      contentType: file.mimetype,
      data: file.buffer,
    });
  }
  @Patch('products/:id/media/:mediaId')
  public updateMedia(
    @Param('id') id: string,
    @Param('mediaId') mediaId: string,
    @Body() input: UpdateProductMediaDto,
  ) {
    return this.catalog.updateProductMedia(id, mediaId, input);
  }
  @Delete('products/:id/media/:mediaId')
  public deleteMedia(
    @Param('id') id: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.catalog.deleteProductMedia(id, mediaId);
  }
  @Post('products/:id/feeding-guide') public replaceFeedingGuide(
    @Param('id') id: string,
    @Body() input: ReplaceFeedingGuideDto,
  ) {
    return this.catalog.replaceFeedingGuide(id, {
      ...input,
      entries: input.entries.map((entry: FeedingGuideEntryDto) => ({
        ...entry,
        petWeightKgMax: entry.petWeightKgMax ?? null,
        dailyGramsMax: entry.dailyGramsMax ?? null,
        lifeStage: entry.lifeStage ?? null,
        conditions: entry.conditions ?? {},
      })),
    });
  }
  @Get('products/:id/feeding-guide')
  public feedingGuide(@Param('id') id: string) {
    return this.catalog.getAdminFeedingGuide(id);
  }
  @Get('variants/:id/competitive-prices')
  public competitivePrices(@Param('id') id: string) {
    return this.catalog.getCompetitivePriceAverage(id);
  }
  @Put('variants/:id/inventory') public setInventory(
    @Param('id') id: string,
    @Body() input: SetInventoryDto,
  ) {
    return this.catalog.setInventory(id, input);
  }
  @Get('variants/:id/inventory/movements')
  public inventoryMovements(@Param('id') id: string) {
    return this.catalog.listInventoryMovements(id);
  }

  @Get('categories') public categories() {
    return this.catalog.listCategories();
  }
  @Post('categories') public createCategory(@Body() input: ReferenceDto) {
    return this.catalog.createCategory(input);
  }
  @Patch('categories/:id') public updateCategory(
    @Param('id') id: string,
    @Body() input: UpdateReferenceDto,
  ) {
    return this.catalog.updateCategory(id, input);
  }
  @Get('brands') public brands() {
    return this.catalog.listBrands();
  }
  @Post('brands') public createBrand(@Body() input: BrandReferenceDto) {
    return this.catalog.createBrand(input);
  }
  @Patch('brands/:id') public updateBrand(
    @Param('id') id: string,
    @Body() input: UpdateBrandReferenceDto,
  ) {
    return this.catalog.updateBrand(id, input);
  }
  @Post('brands/:id/logo/upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  public uploadBrandLogo(
    @Param('id') id: string,
    @UploadedFile() file: UploadedProductImage | undefined,
  ) {
    if (!file) throw new BadRequestException('Se requiere un archivo de logo.');
    return this.catalog.uploadBrandLogo(id, {
      originalName: file.originalname,
      contentType: file.mimetype,
      data: file.buffer,
    });
  }
}

type UploadedProductImage = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};
