import type { ArgumentsHost } from '@nestjs/common';
import type { Request } from 'express';
import type { DomainError } from '../domain/domain-error';

export const errorResponse = (
  host: ArgumentsHost,
  statusCode: number,
  error: DomainError,
) => ({
  statusCode,
  code: error.code,
  message: error.message,
  requestId:
    host.switchToHttp().getRequest<Request & { requestId?: string }>()
      .requestId ?? null,
});
