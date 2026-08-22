import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
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
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import { UserRole } from '../../../users/domain/entities/user.entity';
import { CatalogService } from '../../application/catalog.service';
import {
  AdminProductsQueryDto, BrandReferenceDto, CreateProductDto, CreateVariantDto, ReferenceDto,
  CreateProductMediaDto, FeedingGuideEntryDto, ReplaceFeedingGuideDto,
  SetInventoryDto, UpdateProductDto, UpdateReferenceDto, UpdateVariantDto,
  UpdateBrandReferenceDto, UpdateProductMediaDto, UploadProductMediaDto,
} from '../dto/catalog.dto';
import { CatalogExceptionFilter } from '../filters/catalog-exception.filter';

@ApiTags('Admin catalog')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@UseFilters(CatalogExceptionFilter)
@Controller('admin')
export class AdminCatalogController {
  public constructor(private readonly catalog: CatalogService) {}

  @Get('products') public async products(@Query() query: AdminProductsQueryDto) {
    const page = await this.catalog.listAdminProducts(query);
    return { items: page.items, meta: { page: page.page, perPage: page.perPage, total: page.total, totalPages: Math.ceil(page.total / page.perPage) } };
  }
  @Get('products/:id') public product(@Param('id') id: string) { return this.catalog.getAdminProduct(id); }
  @Post('products') public createProduct(@Body() input: CreateProductDto) { return this.catalog.createProduct(input); }
  @Patch('products/:id') public updateProduct(@Param('id') id: string, @Body() input: UpdateProductDto) { return this.catalog.updateProduct(id, input); }
  @Post('products/:id/variants') public createVariant(@Param('id') id: string, @Body() input: CreateVariantDto) { return this.catalog.createVariant(id, input); }
  @Patch('variants/:id') public updateVariant(@Param('id') id: string, @Body() input: UpdateVariantDto) { return this.catalog.updateVariant(id, input); }
  @Post('products/:id/media') public createMedia(@Param('id') id: string, @Body() input: CreateProductMediaDto) {
    return this.catalog.createProductMedia(id, input);
  }
  @Post('products/:id/media/upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'altText'],
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
      altText: input.altText,
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
        lifeStage: entry.lifeStage ?? null,
        conditions: entry.conditions ?? {},
      })),
    });
  }
  @Get('products/:id/feeding-guide')
  public feedingGuide(@Param('id') id: string) {
    return this.catalog.getAdminFeedingGuide(id);
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

  @Get('categories') public categories() { return this.catalog.listCategories(); }
  @Post('categories') public createCategory(@Body() input: ReferenceDto) { return this.catalog.createCategory(input); }
  @Patch('categories/:id') public updateCategory(@Param('id') id: string, @Body() input: UpdateReferenceDto) { return this.catalog.updateCategory(id, input); }
  @Get('brands') public brands() { return this.catalog.listBrands(); }
  @Post('brands') public createBrand(@Body() input: BrandReferenceDto) { return this.catalog.createBrand(input); }
  @Patch('brands/:id') public updateBrand(@Param('id') id: string, @Body() input: UpdateBrandReferenceDto) { return this.catalog.updateBrand(id, input); }
  @Post('brands/:id/logo/upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
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
