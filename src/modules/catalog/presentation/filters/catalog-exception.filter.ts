import {
  ArgumentsHost, Catch, ExceptionFilter, HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '../../../../shared/domain/domain-error';
import { CatalogConflictError, CatalogNotFoundError } from '../../domain/errors/catalog.error';

import { errorResponse } from '../../../../shared/presentation/error-response';

@Catch(DomainError)
export class CatalogExceptionFilter implements ExceptionFilter {
  public catch(error: DomainError, host: ArgumentsHost): void {
    const status = error instanceof CatalogNotFoundError
      ? HttpStatus.NOT_FOUND
      : error instanceof CatalogConflictError
        ? HttpStatus.CONFLICT
        : HttpStatus.UNPROCESSABLE_ENTITY;
    host.switchToHttp().getResponse<Response>().status(status).json(errorResponse(host, status, error));
  }
}
