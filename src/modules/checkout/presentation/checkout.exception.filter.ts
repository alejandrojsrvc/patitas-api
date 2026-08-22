import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '../../../shared/domain/domain-error';
import {
  CheckoutConflictError,
  CheckoutNotFoundError,
} from '../domain/checkout.error';

import { errorResponse } from '../../../shared/presentation/error-response';

@Catch(DomainError)
export class CheckoutExceptionFilter implements ExceptionFilter {
  public catch(error: DomainError, host: ArgumentsHost): void {
    const status =
      error instanceof CheckoutNotFoundError
        ? HttpStatus.NOT_FOUND
        : error instanceof CheckoutConflictError
          ? HttpStatus.CONFLICT
          : HttpStatus.UNPROCESSABLE_ENTITY;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json(errorResponse(host, status, error));
  }
}
