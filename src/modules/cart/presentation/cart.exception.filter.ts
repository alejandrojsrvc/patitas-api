import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '../../../shared/domain/domain-error';
import { CartValidationError } from '../domain/cart.error';

import { errorResponse } from '../../../shared/presentation/error-response';

@Catch(DomainError)
export class CartExceptionFilter implements ExceptionFilter {
  public catch(error: DomainError, host: ArgumentsHost): void {
    const status = error instanceof CartValidationError ? HttpStatus.UNPROCESSABLE_ENTITY : HttpStatus.BAD_REQUEST;
    host.switchToHttp().getResponse<Response>().status(status).json(errorResponse(host, status, error));
  }
}
