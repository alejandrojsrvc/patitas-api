import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';
import { StructuredExceptionFilter } from './shared/presentation/structured-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
    }),
  );

  const configService = app.get(ConfigService);
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
