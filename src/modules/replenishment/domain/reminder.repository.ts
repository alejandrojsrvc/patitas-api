import type { ReplenishmentReminder, ReplenishmentReminderOwner, ReplenishmentReminderStatus } from './reminder.types';

export const REPLENISHMENT_REMINDER_REPOSITORY = Symbol('REPLENISHMENT_REMINDER_REPOSITORY');

export interface ReplenishmentReminderRepository {
  create(input: { estimateId: string; owner: ReplenishmentReminderOwner; email: string; consentVersion: string }): Promise<ReplenishmentReminder>;
  list(owner: ReplenishmentReminderOwner): Promise<ReplenishmentReminder[]>;
  setStatus(id: string, owner: ReplenishmentReminderOwner, status: ReplenishmentReminderStatus): Promise<ReplenishmentReminder>;
}
