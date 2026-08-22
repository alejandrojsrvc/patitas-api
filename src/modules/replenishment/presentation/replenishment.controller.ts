import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { OptionalAuthGuard } from '../../auth/presentation/guards/optional-auth.guard';
import { CustomerService } from '../../customers/application/customer.service';
import { hashAnonymousToken } from '../../../shared/application/anonymous-token';
import {
  ReplenishmentService,
  ReplenishmentValidationError,
} from '../application/replenishment.service';
import type { ReplenishmentOwner } from '../domain/replenishment.types';
import {
  CreateReplenishmentPlanDto,
  UpdateReplenishmentStatusDto,
} from './replenishment.dto';

@ApiTags('Replenishment plans')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Order-Token', required: false })
@UseGuards(OptionalAuthGuard)
@Controller('replenishment-plans')
export class ReplenishmentController {
  public constructor(
    private readonly plans: ReplenishmentService,
    private readonly customers: CustomerService,
  ) {}

  @Get()
  public async list(
    @Req() request: Request,
    @Headers('x-order-token') token?: string,
  ) {
    return this.plans.list(await owner(request, this.customers, token));
  }
  @Get(':id')
  public async find(
    @Req() request: Request,
    @Param('id') id: string,
    @Headers('x-order-token') token?: string,
  ) {
    return this.plans.find(id, await owner(request, this.customers, token));
  }
  @Post()
  public async create(
    @Req() request: Request,
    @Body() input: CreateReplenishmentPlanDto,
    @Headers('x-order-token') token?: string,
  ) {
    const planOwner = await owner(request, this.customers, token);
    if (!planOwner.customerId && !planOwner.guestTokenHash)
      throw new ReplenishmentValidationError(
        'Inicia sesión o presenta X-Order-Token.',
      );
    return this.plans.create(
      { ...input, guestAccessTokenHash: planOwner.guestTokenHash },
      planOwner,
    );
  }
  @Patch(':id/status')
  public async status(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() input: UpdateReplenishmentStatusDto,
    @Headers('x-order-token') token?: string,
  ) {
    return this.plans.setStatus(
      id,
      await owner(request, this.customers, token),
      input.status,
    );
  }
  @Post(':id/reorder-cart')
  public async reorder(
    @Req() request: Request,
    @Param('id') id: string,
    @Headers('x-order-token') token?: string,
  ) {
    return this.plans.reorder(id, await owner(request, this.customers, token));
  }
}

const owner = async (
  request: Request,
  customers: CustomerService,
  token?: string,
): Promise<ReplenishmentOwner> => {
  const userId = (request as Request & { user?: { userId: string } }).user
    ?.userId;
  if (userId) return { customerId: (await customers.findByUserId(userId)).id };
  return token ? { guestTokenHash: hashAnonymousToken(token) } : {};
};
