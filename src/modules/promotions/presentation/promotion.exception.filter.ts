import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '../../../shared/domain/domain-error';
import { PromotionNotFoundError } from '../domain/promotion.error';

import { errorResponse } from '../../../shared/presentation/error-response';

@Catch(DomainError)
export class PromotionExceptionFilter implements ExceptionFilter {
  public catch(error: DomainError, host: ArgumentsHost): void {
    const status =
      error instanceof PromotionNotFoundError
        ? HttpStatus.NOT_FOUND
        : HttpStatus.UNPROCESSABLE_ENTITY;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json(errorResponse(host, status, error));
  }
}
