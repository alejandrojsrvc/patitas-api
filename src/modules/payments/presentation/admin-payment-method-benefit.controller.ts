import { Body, Controller, Get, Patch, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { UserRole } from '../../users/domain/entities/user.entity';
import { AdminAuditInterceptor } from '../../../infrastructure/audit/admin-audit.interceptor';
import { PaymentMethodBenefitService } from '../application/payment-method-benefit.service';
import { UpdateTransferConfigurationDto } from './payment-method-benefit.dto';

@ApiTags('Admin payment benefits')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@Controller('admin/payment-method-benefits')
export class AdminPaymentMethodBenefitController {
  public constructor(private readonly benefits: PaymentMethodBenefitService) {}

  @Get('transfer')
  public transfer() {
    return this.benefits.transfer();
  }

  @Patch('transfer')
  public update(@Body() input: UpdateTransferConfigurationDto) {
    return this.benefits.updateTransfer({
      ...input,
      instructions:
        input.instructions === undefined
          ? undefined
          : input.instructions === null
            ? null
            : {
                accountHolder: input.instructions.accountHolder,
                bank: input.instructions.bank,
                alias: input.instructions.alias ?? null,
                cbu: input.instructions.cbu ?? null,
                note: input.instructions.note ?? null,
              },
    });
  }
}
