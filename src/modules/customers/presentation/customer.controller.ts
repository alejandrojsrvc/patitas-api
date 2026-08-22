import { Body, Controller, Get, Param, Patch, Post, Query, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { UserRole } from '../../users/domain/entities/user.entity';
import { AdminAuditInterceptor } from '../../../infrastructure/audit/admin-audit.interceptor';
import { CustomerService } from '../application/customer.service';
import { CreateCustomerDto, CustomersQueryDto, UpdateCustomerDto } from './customer.dto';
import { CustomerExceptionFilter } from './customer.exception.filter';

@ApiTags('Admin customers')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@UseFilters(CustomerExceptionFilter)
@Controller('admin/customers')
export class AdminCustomerController {
  public constructor(private readonly customers: CustomerService) {}

  @Get() public list(@Query() query: CustomersQueryDto) { return this.customers.list(query); }
  @Get(':id') public find(@Param('id') id: string) { return this.customers.find(id); }
  @Post() public create(@Body() input: CreateCustomerDto) { return this.customers.create(input); }
  @Patch(':id') public update(@Param('id') id: string, @Body() input: UpdateCustomerDto) { return this.customers.update(id, input); }
}
