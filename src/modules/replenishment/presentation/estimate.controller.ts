import { Body, Controller, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OptionalAuthGuard } from '../../auth/presentation/guards/optional-auth.guard';
import type { AuthenticatedUser } from '../../auth/presentation/authenticated-user';
import { CustomerService } from '../../customers/application/customer.service';
import { EstimateService } from '../application/estimate.service';
import { CreateEstimateDto } from './estimate.dto';
import type { Request } from 'express';
import { createAnonymousToken, hashAnonymousToken } from '../../../shared/application/anonymous-token';

@ApiTags('Customer replenishment estimates')
@ApiBearerAuth()
@UseGuards(OptionalAuthGuard)
@Controller('replenishment-estimates')
export class EstimateController {
  public constructor(
    private readonly estimates: EstimateService,
    private readonly customers: CustomerService,
  ) {}

  @Post()
  public async create(@Req() request: Request, @Headers('x-replenishment-token') token: string | undefined, @Body() input: CreateEstimateDto) {
    const user = (request as Request & { user?: AuthenticatedUser }).user;
    const accessToken = !user && !token ? createAnonymousToken() : token;
    const estimate = await this.estimates.create(
      user ? (await this.customers.findByUserId(user.userId)).id : null,
      {
        ...input,
        bagStartedAt: input.bagStartedAt ? new Date(input.bagStartedAt) : undefined,
      },
      !user && accessToken ? hashAnonymousToken(accessToken) : null,
    );
    return user ? estimate : { ...estimate, accessToken };
  }
}
