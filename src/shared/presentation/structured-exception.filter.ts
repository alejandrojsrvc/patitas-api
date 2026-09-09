import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { DomainError } from '../domain/domain-error';

@Catch()
export class StructuredExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(StructuredExceptionFilter.name);

  public catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request & { requestId?: string }>();
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : error instanceof DomainError && error.code.endsWith('_CONFLICT')
          ? Number(HttpStatus.CONFLICT)
          : error instanceof DomainError
            ? HttpStatus.UNPROCESSABLE_ENTITY
            : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = error instanceof HttpException ? error.getResponse() : undefined;
    const requestId = request.requestId ?? randomUUID();
    if (status === Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error(
        JSON.stringify({ event: 'unhandled_http_error', requestId, method: request.method, path: request.path }),
        error instanceof Error ? error.stack : undefined,
      );
    }
    const message =
      typeof payload === 'object' && payload && 'message' in payload
        ? (payload as { message: string | string[] }).message
        : status === Number(HttpStatus.INTERNAL_SERVER_ERROR)
          ? 'Ocurrió un error interno.'
          : error instanceof Error
            ? error.message
            : 'Error interno.';
    const extra =
      typeof payload === 'object' && payload && !Array.isArray(payload) ? (payload as { code?: string; fieldErrors?: Record<string, string> }) : {};
    response.status(status).json({
      statusCode: status,
      code: extra.code ?? (error instanceof DomainError ? error.code : `HTTP_${status}`),
      message,
      fieldErrors: extra.fieldErrors,
      requestId,
      traceId: requestId,
    });
  }
}
