import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { EstimateController } from '../../src/modules/replenishment/presentation/estimate.controller';
import { ReplenishmentReminderController } from '../../src/modules/replenishment/presentation/reminder.controller';
import { EstimateService } from '../../src/modules/replenishment/application/estimate.service';
import { ReplenishmentReminderService } from '../../src/modules/replenishment/application/reminder.service';
import { CustomerService } from '../../src/modules/customers/application/customer.service';
import { NotificationService } from '../../src/modules/notifications/application/notification.service';
import { OptionalAuthGuard } from '../../src/modules/auth/presentation/guards/optional-auth.guard';
import { PurchaseScheduleController } from '../../src/modules/purchase-schedules/presentation/purchase-schedule.controller';
import { PurchaseScheduleService } from '../../src/modules/purchase-schedules/application/purchase-schedule.service';
import { AuthGuard } from '../../src/modules/auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../src/modules/auth/presentation/guards/roles.guard';

describe('replenishment and purchase schedule HTTP contracts', () => {
  let app: INestApplication;
  let httpInstance: Parameters<typeof request>[0];
  const estimate = {
    id: 'estimate-1',
    dailyGrams: { min: 100, max: 120 },
    durationDays: { min: 20, max: 24 },
    source: 'GENERAL_FALLBACK',
    sourceLabel: 'Estimación general',
    sourceUrl: null,
    estimatedDepletionDate: new Date('2026-09-26T00:00:00.000Z'),
    assumptions: [],
    productId: '00000000-0000-4000-8000-000000000001',
    variantId: '00000000-0000-4000-8000-000000000002',
    custom: null,
  };

  const estimates = { create: jest.fn().mockResolvedValue(estimate) };
  const reminders = {
    create: jest.fn().mockResolvedValue({
      id: 'reminder-1',
      status: 'ACTIVE',
      nextReminderAt: new Date('2026-09-21T00:00:00.000Z'),
    }),
    list: jest.fn().mockResolvedValue([]),
    setStatus: jest.fn().mockResolvedValue({ id: 'reminder-1', status: 'PAUSED' }),
  };
  const notifications = {
    recordConsent: jest.fn().mockResolvedValue({ id: 'consent-1' }),
  };
  const schedules = {
    configure: jest.fn().mockResolvedValue({
      id: 'schedule-1',
      frequencyDays: 14,
      discountPercent: '10.00',
      leadDays: 5,
      status: 'DRAFT',
    }),
  };
  const customers = {
    findByUserId: jest.fn().mockResolvedValue({ id: 'customer-1' }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [EstimateController, ReplenishmentReminderController, PurchaseScheduleController],
      providers: [
        { provide: EstimateService, useValue: estimates },
        { provide: ReplenishmentReminderService, useValue: reminders },
        { provide: NotificationService, useValue: notifications },
        { provide: PurchaseScheduleService, useValue: schedules },
        { provide: CustomerService, useValue: customers },
      ],
    })
      .overrideGuard(OptionalAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { user: object } } }) => {
          context.switchToHttp().getRequest().user = { userId: 'user-1' };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
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
    httpInstance = app.getHttpAdapter().getInstance() as Parameters<typeof request>[0];
  });

  afterAll(async () => app.close());

  it('returns the public estimate and access token for an anonymous web calculator', async () => {
    const response = await request(httpInstance)
      .post('/api/v1/replenishment-estimates')
      .send({
        pet: { name: 'Luna', species: 'dog', weightKg: 12, lifeStage: 'adult' },
        food: { productId: estimate.productId, variantId: estimate.variantId },
      })
      .expect(201);

    const body = response.body as { id: string; accessToken: string };
    expect(body.id).toBe(estimate.id);
    expect(body.accessToken).toEqual(expect.any(String));
    expect(estimates.create).toHaveBeenCalledWith(null, expect.anything(), expect.any(String));
  });

  it('activates an email reminder using the anonymous replenishment token', async () => {
    const response = await request(httpInstance)
      .post('/api/v1/replenishment-reminders')
      .set('X-Replenishment-Token', 'anonymous-token')
      .send({
        estimateId: '00000000-0000-4000-8000-000000000003',
        email: 'user@example.com',
        consent: true,
        consentVersion: '2026-09-02',
      })
      .expect(201);

    expect(response.body).toEqual({
      id: 'reminder-1',
      status: 'ACTIVE',
      nextReminderAt: '2026-09-21T00:00:00.000Z',
    });
    expect(notifications.recordConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'EMAIL',
        destination: 'user@example.com',
      }),
    );
  });

  it('returns the schedule contract for the authenticated web/mobile checkout', async () => {
    const response = await request(httpInstance)
      .post('/api/v1/mobile/checkout/sessions/00000000-0000-4000-8000-000000000004/purchase-schedule')
      .send({ enabled: true, frequencyDays: 14 })
      .expect(201);

    expect(response.body).toMatchObject({
      id: 'schedule-1',
      frequencyDays: 14,
      discountPercent: '10.00',
      leadDays: 5,
      status: 'DRAFT',
    });
  });
});
