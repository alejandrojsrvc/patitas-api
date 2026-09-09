export const PURCHASE_SCHEDULE_FREQUENCIES = [7, 14, 21, 30] as const;
export const PURCHASE_SCHEDULE_DISCOUNT_PERCENT = 10;
export const PURCHASE_SCHEDULE_LEAD_DAYS = 5;

export interface PurchaseScheduleConfiguration {
  id: string;
  enabled: boolean;
  discountPercent: string;
  leadDays: number;
  createdAt: Date;
  updatedAt: Date;
}

export type PurchaseScheduleStatus = 'DRAFT' | 'PENDING_PAYMENT' | 'ACTIVE' | 'AWAITING_CONFIRMATION' | 'PAUSED' | 'CANCELLED';

export interface PurchaseSchedule {
  id: string;
  customerId: string;
  checkoutSessionId: string | null;
  initialOrderId: string | null;
  orderLineId: string | null;
  variantId: string;
  quantity: number;
  frequencyDays: number;
  discountPercent: string;
  leadDays: number;
  status: PurchaseScheduleStatus;
  nextOrderAt: Date | null;
  nextReminderAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
