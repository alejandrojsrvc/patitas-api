import type { PurchaseScheduleConfiguration, PurchaseSchedule, PurchaseScheduleStatus } from './purchase-schedule.types';

export const PURCHASE_SCHEDULE_REPOSITORY = Symbol('PURCHASE_SCHEDULE_REPOSITORY');

export interface PurchaseScheduleRepository {
  configure(input: { customerId: string; checkoutSessionId: string; enabled: boolean; frequencyDays?: number }): Promise<PurchaseSchedule | null>;
  configuration(): Promise<PurchaseScheduleConfiguration>;
  updateConfiguration(input: { enabled?: boolean; discountPercent?: string; leadDays?: number }): Promise<PurchaseScheduleConfiguration>;
  list(customerId: string): Promise<PurchaseSchedule[]>;
  setStatus(id: string, customerId: string, status: PurchaseScheduleStatus): Promise<PurchaseSchedule>;
  prepareCheckout(id: string, customerId: string): Promise<{ cartId: string }>;
}
