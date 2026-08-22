import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '../../../shared/domain/domain-error';
import {
  PricingNotFoundError,
  StalePricingReviewError,
} from '../domain/errors/pricing.error';

import { errorResponse } from '../../../shared/presentation/error-response';

@Catch(DomainError)
export class PricingExceptionFilter implements ExceptionFilter {
  public catch(error: DomainError, host: ArgumentsHost): void {
    const status =
      error instanceof PricingNotFoundError
        ? HttpStatus.NOT_FOUND
        : error instanceof StalePricingReviewError
          ? HttpStatus.CONFLICT
          : HttpStatus.UNPROCESSABLE_ENTITY;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json(errorResponse(host, status, error));
  }
}
