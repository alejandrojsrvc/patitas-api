import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UseFilters,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { UserRole } from '../../users/domain/entities/user.entity';
import { AdminAuditInterceptor } from '../../../infrastructure/audit/admin-audit.interceptor';
import { SupplierService } from '../application/supplier.service';
import {
  CreateSupplierDto,
  CreateSupplierOfferDto,
  SupplierOffersQueryDto,
  SuppliersQueryDto,
  UpdateSupplierDto,
  UpdateSupplierOfferDto,
} from './supplier.dto';
import { SupplierExceptionFilter } from './supplier-exception.filter';
import { csv } from '../../../shared/application/csv';

@ApiTags('Admin suppliers')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@UseFilters(SupplierExceptionFilter)
@Controller('admin')
export class AdminSuppliersController {
  public constructor(private readonly suppliers: SupplierService) {}
  @Get('suppliers/export-csv')
  @ApiProduces('text/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="suppliers.csv"')
  public async exportSuppliers() {
    const suppliers = await this.suppliers.listAllSuppliers();
    return csv(
      ['uuid', 'supplier_id', 'name', 'active'],
      suppliers.map((supplier) => [
        supplier.id,
        supplier.id,
        supplier.name,
        supplier.active,
      ]),
    );
  }
  @Get('suppliers') public list(@Query() query: SuppliersQueryDto) {
    return this.suppliers.listSuppliers(query);
  }
  @Get('suppliers/:id') public async find(@Param('id') id: string) {
    const [supplier, offers] = await Promise.all([
      this.suppliers.findSupplier(id),
      this.suppliers.listOffers({ supplierId: id }),
    ]);
    return { ...supplier, offers };
  }
  @Post('suppliers') public create(@Body() input: CreateSupplierDto) {
    return this.suppliers.createSupplier(input);
  }
  @Patch('suppliers/:id') public update(
    @Param('id') id: string,
    @Body() input: UpdateSupplierDto,
  ) {
    return this.suppliers.updateSupplier(id, input);
  }
  @Get('supplier-offers') public offers(
    @Query() query: SupplierOffersQueryDto,
  ) {
    return this.suppliers.listOffers(query);
  }
  @Get('supplier-offers/export-csv')
  @ApiProduces('text/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="supplier-offers.csv"')
  public async exportOffers() {
    const offers = await this.suppliers.listAllOffers();
    return csv(
      [
        'offer_id',
        'supplier_id',
        'supplier_name',
        'variant_id',
        'product_name',
        'sku',
        'supplier_sku',
        'unit_cost',
        'currency',
        'stock_status',
        'lead_time_hours',
        'fulfillment_mode',
        'supplier_cutoff',
        'supplier_to_depot_minutes',
        'fulfillment_cost',
        'minimum_quantity',
        'active',
        'revision',
        'updated_at',
      ],
      offers.map((offer) => [
        offer.id,
        offer.supplierId,
        offer.supplierName,
        offer.variantId,
        offer.productName,
        offer.sku,
        offer.supplierSku,
        offer.unitCost,
        offer.currency,
        offer.stockStatus,
        offer.leadTimeHours,
        offer.fulfillmentMode,
        offer.supplierCutoff,
        offer.supplierToDepotMinutes,
        offer.fulfillmentCost,
        offer.minimumQuantity,
        offer.active,
        offer.revision,
        offer.updatedAt,
      ]),
    );
  }
  @Get('supplier-offers/import-template')
  @ApiProduces('text/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="supplier-offers-template.csv"',
  )
  public importTemplate() {
    return [
      'supplier_id,supplier_name,variant_id,sku,barcode,ean,supplier_sku,unit_cost,stock_status,lead_time_hours,fulfillment_mode,supplier_cutoff,supplier_to_depot_minutes,fulfillment_cost,minimum_quantity,active',
      ',NOMBRE_PROVEEDOR,,,SKU_VARIANTE,,PROV-001,12500.00,AVAILABLE,48,STANDARD,,,0.00,1,true',
      '',
    ].join('\n');
  }
  @Get('supplier-offers/:id') public offer(@Param('id') id: string) {
    return this.suppliers.findOffer(id);
  }
  @Post('supplier-offers/import-csv')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        dryRun: { type: 'boolean', default: false },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  public importOffers(
    @UploadedFile() file: UploadedSupplierOffersCsv | undefined,
    @Body('dryRun') dryRun?: string | boolean,
  ) {
    if (!file) throw new BadRequestException('Se requiere un archivo CSV.');
    return this.suppliers.importOffers(file.buffer, {
      dryRun: dryRun === true || dryRun === 'true',
    });
  }
  @Post('supplier-offers') public createOffer(
    @Body() input: CreateSupplierOfferDto,
  ) {
    return this.suppliers.createOffer(input);
  }
  @Patch('supplier-offers/:id') public updateOffer(
    @Param('id') id: string,
    @Body() input: UpdateSupplierOfferDto,
  ) {
    return this.suppliers.updateOffer(id, input);
  }
}

type UploadedSupplierOffersCsv = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};
