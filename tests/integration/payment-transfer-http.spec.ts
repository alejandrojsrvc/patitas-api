/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PaymentController } from '../../src/modules/payments/presentation/payment.controller';
import { AdminManualTransferController } from '../../src/modules/payments/presentation/admin-manual-transfer.controller';
import { PaymentService } from '../../src/modules/payments/application/payment.service';
import { CustomerService } from '../../src/modules/customers/application/customer.service';
import { PaymentProviderConfigurationService } from '../../src/modules/payments/application/payment-provider-configuration.service';
import { PAYMENT_PROVIDER_RESOLVER } from '../../src/shared/application/ports/payment-provider.interface';
import { OptionalAuthGuard } from '../../src/modules/auth/presentation/guards/optional-auth.guard';
import { AuthGuard } from '../../src/modules/auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../src/modules/auth/presentation/guards/roles.guard';
import { AdminAuditInterceptor } from '../../src/infrastructure/audit/admin-audit.interceptor';
import { hashAnonymousToken } from '../../src/shared/application/anonymous-token';

describe('payment transfer HTTP contracts', () => {
  let app: INestApplication;
  const payments = {
    transferStatus: jest.fn().mockResolvedValue({
      orderId: 'order-1',
      attemptId: 'attempt-1',
      status: 'PENDING',
      expectedAmount: '43650.00',
      currency: 'ARS',
      expiresAt: null,
      reportedAt: null,
      reportedReference: null,
      proofUrl: null,
      instructions: null,
    }),
    reportTransfer: jest.fn().mockResolvedValue({
      orderId: 'order-1',
      attemptId: 'attempt-1',
      status: 'REPORTED',
      expectedAmount: '43650.00',
      currency: 'ARS',
      expiresAt: null,
      reportedAt: '2026-09-02T12:00:00.000Z',
      reportedReference: 'TRF-1',
      proofUrl: null,
      instructions: null,
    }),
    listPendingTransfers: jest.fn().mockResolvedValue([]),
    confirmTransfer: jest.fn().mockResolvedValue({
      orderId: 'order-1',
      attemptId: 'attempt-1',
      status: 'APPROVED',
      expectedAmount: '43650.00',
      currency: 'ARS',
      expiresAt: null,
      reportedAt: null,
      reportedReference: 'TRF-1',
      proofUrl: null,
      instructions: null,
    }),
  };
  const configurations = {
    availableMethods: jest.fn().mockResolvedValue([
      {
        provider: 'manual_transfer',
        paymentMethod: 'BANK_TRANSFER',
        priority: 0,
        benefit: {
          percentage: '3.00',
          description: 'Descuento por transferencia',
        },
        transfer: {
          expirationMinutes: 120,
          instructions: {
            accountHolder: 'Patitas SRL',
            bank: 'Banco de prueba',
            alias: 'patitas.transferencia',
            cbu: null,
            note: null,
          },
        },
      },
    ]),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PaymentController, AdminManualTransferController],
      providers: [
        { provide: PaymentService, useValue: payments },
        { provide: CustomerService, useValue: {} },
        {
          provide: PaymentProviderConfigurationService,
          useValue: configurations,
        },
        {
          provide: PAYMENT_PROVIDER_RESOLVER,
          useValue: { resolve: jest.fn() },
        },
      ],
    })
      .overrideGuard(OptionalAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { user: object } } }) => {
          context.switchToHttp().getRequest().user = {
            userId: 'admin-1',
            role: 'ADMIN',
          };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideInterceptor(AdminAuditInterceptor)
      .useValue({
        intercept: (_context: unknown, next: { handle: () => unknown }) => next.handle(),
      })
      .compile();
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

  it('exposes BANK_TRANSFER with its discount and instructions', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/payments/methods')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject([
          {
            provider: 'manual_transfer',
            paymentMethod: 'BANK_TRANSFER',
            benefit: { percentage: '3.00' },
            transfer: { expirationMinutes: 120 },
          },
        ]);
      });
  });

  it('keeps customer reporting separate from payment approval', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/payments/orders/order-1/transfer/report')
      .set('X-Order-Token', 'public-token')
      .send({ reference: 'TRF-1' })
      .expect(201);

    expect(payments.reportTransfer).toHaveBeenCalledWith('order-1', { publicTokenHash: hashAnonymousToken('public-token') }, 'TRF-1');
  });

  it('requires admin flow for confirmation and passes the actor to the use case', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/payment-method-benefits/transfers/attempt-1/confirm')
      .send({ amount: '43650.00', reference: 'TRF-1', note: 'Verificado' })
      .expect(201);

    expect(payments.confirmTransfer).toHaveBeenCalledWith('attempt-1', {
      amount: '43650.00',
      reference: 'TRF-1',
      note: 'Verificado',
      actorUserId: 'admin-1',
    });
  });
});
