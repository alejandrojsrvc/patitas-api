import { DomainError } from '../../../shared/domain/domain-error';
import type { PurchaseScheduleRepository } from '../domain/purchase-schedule.repository';
import { PURCHASE_SCHEDULE_DISCOUNT_PERCENT, PURCHASE_SCHEDULE_FREQUENCIES, PURCHASE_SCHEDULE_LEAD_DAYS } from '../domain/purchase-schedule.types';

export class PurchaseScheduleValidationError extends DomainError {
  public constructor(message: string) {
    super(message, 'PURCHASE_SCHEDULE_VALIDATION_FAILED');
  }
}

export class PurchaseScheduleService {
  public constructor(private readonly repository: PurchaseScheduleRepository) {}

  public configure(input: { customerId: string; checkoutSessionId: string; enabled: boolean; frequencyDays?: number }) {
    if (!input.enabled) return this.repository.configure(input);
    if (!PURCHASE_SCHEDULE_FREQUENCIES.includes(input.frequencyDays as never))
      throw new PurchaseScheduleValidationError('La frecuencia debe ser de 7, 14, 21 o 30 días.');
    return this.repository.configure({
      ...input,
      frequencyDays: input.frequencyDays,
    });
  }

  public list(customerId: string) {
    return this.repository.list(customerId);
  }

  public configuration() {
    return this.repository.configuration();
  }

  public updateConfiguration(input: { enabled?: boolean; discountPercent?: string; leadDays?: number }) {
    if (
      input.discountPercent !== undefined &&
      (!/^\d+(\.\d{1,2})?$/.test(input.discountPercent) || Number(input.discountPercent) < 0 || Number(input.discountPercent) > 100)
    )
      throw new PurchaseScheduleValidationError('El porcentaje de compra programada debe estar entre 0 y 100.');
    if (input.leadDays !== undefined && (!Number.isInteger(input.leadDays) || input.leadDays < 0 || input.leadDays > 30))
      throw new PurchaseScheduleValidationError('Los días mínimos de anticipación deben estar entre 0 y 30.');
    return this.repository.updateConfiguration(input);
  }

  public setStatus(id: string, customerId: string, status: string) {
    if (!['ACTIVE', 'PAUSED', 'CANCELLED'].includes(status))
      throw new PurchaseScheduleValidationError('El estado de la compra programada no es válido.');
    return this.repository.setStatus(id, customerId, status as 'ACTIVE' | 'PAUSED' | 'CANCELLED');
  }

  public prepareCheckout(id: string, customerId: string) {
    return this.repository.prepareCheckout(id, customerId);
  }

  public static defaults() {
    return {
      discountPercent: PURCHASE_SCHEDULE_DISCOUNT_PERCENT,
      leadDays: PURCHASE_SCHEDULE_LEAD_DAYS,
      frequencies: [...PURCHASE_SCHEDULE_FREQUENCIES],
    };
  }
}
