import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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

@ApiTags('Admin suppliers')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@UseFilters(SupplierExceptionFilter)
@Controller('admin')
export class AdminSuppliersController {
  public constructor(private readonly suppliers: SupplierService) {}
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
  @Get('supplier-offers/:id') public offer(@Param('id') id: string) {
    return this.suppliers.findOffer(id);
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
