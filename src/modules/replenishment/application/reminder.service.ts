import { DomainError } from '../../../shared/domain/domain-error';
import type { ReplenishmentReminderRepository } from '../domain/reminder.repository';
import type { ReplenishmentReminderOwner, ReplenishmentReminderStatus } from '../domain/reminder.types';

export class ReplenishmentReminderValidationError extends DomainError {
  public constructor(message: string) {
    super(message, 'REPLENISHMENT_REMINDER_VALIDATION_FAILED');
  }
}

export class ReplenishmentReminderService {
  public constructor(private readonly repository: ReplenishmentReminderRepository) {}

  public create(input: { estimateId: string; owner: ReplenishmentReminderOwner; email: string; consent: boolean; consentVersion: string }) {
    if (!input.consent) {
      throw new ReplenishmentReminderValidationError('Debes aceptar recibir el aviso por email.');
    }
    if (!/^\S+@\S+\.\S+$/.test(input.email.trim())) {
      throw new ReplenishmentReminderValidationError('El email no es válido.');
    }
    if (!input.consentVersion.trim()) {
      throw new ReplenishmentReminderValidationError('La versión del consentimiento es obligatoria.');
    }
    if (!input.owner.customerId && !input.owner.guestTokenHash) {
      throw new ReplenishmentReminderValidationError('Se requiere autenticación o X-Replenishment-Token.');
    }
    return this.repository.create({
      estimateId: input.estimateId,
      owner: input.owner,
      email: input.email.trim().toLowerCase(),
      consentVersion: input.consentVersion.trim(),
    });
  }

  public list(owner: ReplenishmentReminderOwner) {
    return this.repository.list(owner);
  }

  public setStatus(id: string, owner: ReplenishmentReminderOwner, status: ReplenishmentReminderStatus) {
    if (!['ACTIVE', 'PAUSED', 'CANCELLED'].includes(status))
      throw new ReplenishmentReminderValidationError('El estado del recordatorio no es válido.');
    return this.repository.setStatus(id, owner, status);
  }
}
