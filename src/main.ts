import {
  BadRequestException,
  Logger,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';
import { StructuredExceptionFilter } from './shared/presentation/structured-exception.filter';

const SLOW_REQUEST_THRESHOLD_MS = 750;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const performanceLogger = new Logger('HttpPerformance');
  const configService = app.get(ConfigService);
  const corsOrigins = configService
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'X-Cart-Token',
      'X-Checkout-Token',
      'X-Order-Token',
      'X-Device-Id',
      'X-Mobile-Device-Id',
      'X-Platform',
      'X-App-Version',
      'Idempotency-Key',
    ],
    exposedHeaders: ['X-Request-Id'],
    credentials: false,
    optionsSuccessStatus: 204,
  });

  const apiPrefix = 'api/v1';
  app.setGlobalPrefix(apiPrefix);
  app.use(
    (
      request: Request & { requestId?: string },
      response: Response,
      next: () => void,
    ) => {
      const requestId = request.headers['x-request-id'];
      request.requestId =
        typeof requestId === 'string' && requestId.trim()
          ? requestId.trim()
          : randomUUID();
      response.setHeader('x-request-id', request.requestId);
      const startedAt = process.hrtime.bigint();
      response.once('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        if (durationMs < SLOW_REQUEST_THRESHOLD_MS) return;
        performanceLogger.warn(
          JSON.stringify({
            event: 'slow_http_request',
            requestId: request.requestId,
            method: request.method,
            path: request.originalUrl.split('?')[0],
            statusCode: response.statusCode,
            durationMs: Number(durationMs.toFixed(1)),
          }),
        );
      });
      next();
    },
  );
  app.enableShutdownHooks();
  app.useGlobalFilters(new StructuredExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors: ValidationError[]) =>
        new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Revisá los datos ingresados.',
          fieldErrors: Object.fromEntries(
            errors.map((error) => [
              error.property,
              Object.values(error.constraints ?? {})[0] ??
                'El valor no es válido.',
            ]),
          ),
        }),
    }),
  );

  if (configService.getOrThrow<string>('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Patitas API')
      .setDescription('Contrato de las superficies Public, Customer y Admin.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const openApiDocument = SwaggerModule.createDocument(app, swaggerConfig, {
      include: [AppModule],
      deepScanRoutes: true,
      ignoreGlobalPrefix: false,
    });
    SwaggerModule.setup(`${apiPrefix}/docs`, app, openApiDocument, {
      jsonDocumentUrl: `${apiPrefix}/docs-json`,
    });
  }
  await app.listen(configService.getOrThrow<number>('PORT'));
}
void bootstrap();
