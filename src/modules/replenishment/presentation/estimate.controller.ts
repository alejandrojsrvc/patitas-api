import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/presentation/authenticated-user';
import { CustomerService } from '../../customers/application/customer.service';
import { EstimateService } from '../application/estimate.service';
import { CreateEstimateDto } from './estimate.dto';

@ApiTags('Customer replenishment estimates')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('replenishment-estimates')
export class EstimateController {
  public constructor(
    private readonly estimates: EstimateService,
    private readonly customers: CustomerService,
  ) {}

  @Post()
  public async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateEstimateDto,
  ) {
    return this.estimates.create(
      (await this.customers.findByUserId(user.userId)).id,
      input,
    );
  }
}
