import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '../../../shared/domain/domain-error';

import { errorResponse } from '../../../shared/presentation/error-response';

@Catch(DomainError)
export class ShippingExceptionFilter implements ExceptionFilter {
  public catch(error: DomainError, host: ArgumentsHost): void {
    const status =
      error.code === 'SHIPPING_VALIDATION_FAILED'
        ? HttpStatus.UNPROCESSABLE_ENTITY
        : HttpStatus.NOT_FOUND;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json(errorResponse(host, status, error));
  }
}
