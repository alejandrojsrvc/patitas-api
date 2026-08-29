import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { DomainError } from '../domain/domain-error';

@Catch()
export class StructuredExceptionFilter implements ExceptionFilter {
  public catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host
      .switchToHttp()
      .getRequest<Request & { requestId?: string }>();
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : error instanceof DomainError && error.code.endsWith('_CONFLICT')
          ? HttpStatus.CONFLICT
          : error instanceof DomainError
            ? HttpStatus.UNPROCESSABLE_ENTITY
            : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload =
      error instanceof HttpException ? error.getResponse() : undefined;
    const message =
      typeof payload === 'object' && payload && 'message' in payload
        ? (payload as { message: string | string[] }).message
        : error instanceof Error
          ? error.message
          : 'Error interno.';
    const extra =
      typeof payload === 'object' && payload && !Array.isArray(payload)
        ? (payload as { code?: string; fieldErrors?: Record<string, string> })
        : {};
    response.status(status).json({
      statusCode: status,
      code:
        extra.code ??
        (error instanceof DomainError ? error.code : `HTTP_${status}`),
      message,
      fieldErrors: extra.fieldErrors,
      requestId: request.requestId ?? randomUUID(),
      traceId: request.requestId ?? randomUUID(),
    });
  }
}
