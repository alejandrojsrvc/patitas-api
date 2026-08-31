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
        : error.code.endsWith('_CONFLICT')
          ? HttpStatus.CONFLICT
          : error instanceof CheckoutConflictError
            ? HttpStatus.CONFLICT
            : HttpStatus.UNPROCESSABLE_ENTITY;
    const response = errorResponse(host, status, error);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({
        ...response,
        ...(error instanceof CheckoutConflictError && error.currentState
          ? { currentState: error.currentState }
          : {}),
      });
  }
}
