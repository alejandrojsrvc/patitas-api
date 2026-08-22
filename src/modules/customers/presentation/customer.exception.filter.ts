import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '../../../shared/domain/domain-error';
import { CustomerNotFoundError } from '../domain/customer.error';

import { errorResponse } from '../../../shared/presentation/error-response';

@Catch(DomainError)
export class CustomerExceptionFilter implements ExceptionFilter {
  public catch(error: DomainError, host: ArgumentsHost): void {
    const status =
      error instanceof CustomerNotFoundError
        ? HttpStatus.NOT_FOUND
        : HttpStatus.UNPROCESSABLE_ENTITY;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json(errorResponse(host, status, error));
  }
}
