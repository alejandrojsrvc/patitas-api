import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '../../../shared/domain/domain-error';
import {
  SupplierConflictError,
  SupplierNotFoundError,
} from '../application/supplier.service';

import { errorResponse } from '../../../shared/presentation/error-response';

@Catch(DomainError)
export class SupplierExceptionFilter implements ExceptionFilter {
  public catch(error: DomainError, host: ArgumentsHost): void {
    const status = error instanceof SupplierNotFoundError
      ? HttpStatus.NOT_FOUND
      : error instanceof SupplierConflictError
        ? HttpStatus.CONFLICT
        : HttpStatus.UNPROCESSABLE_ENTITY;
    host.switchToHttp().getResponse<Response>().status(status).json({
      statusCode: status,
      code: error.code,
      message: error.message,
    });
  }
}
