import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '../../../shared/domain/domain-error';
import { OrderConflictError, OrderNotFoundError } from '../domain/order.error';

import { errorResponse } from '../../../shared/presentation/error-response';

@Catch(DomainError)
export class OrderExceptionFilter implements ExceptionFilter {
  public catch(error: DomainError, host: ArgumentsHost): void {
    const status = error instanceof OrderNotFoundError ? HttpStatus.NOT_FOUND : error instanceof OrderConflictError ? HttpStatus.CONFLICT : HttpStatus.UNPROCESSABLE_ENTITY;
    host.switchToHttp().getResponse<Response>().status(status).json(errorResponse(host, status, error));
  }
}
