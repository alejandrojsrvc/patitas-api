/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import dotenv from 'dotenv';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

describe('checkout boundaries (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => app.close());

  it('rejects non-finite shipping quote values with a domain error', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/shipping/quote')
      .query({ postalCode: '1000', subtotal: 'not-a-number' })
      .expect(422)
      .expect(({ body }) => {
        expect(body.code).toBe('SHIPPING_VALIDATION_FAILED');
      });
  });
});
