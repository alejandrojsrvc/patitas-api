import { DomainError } from '../../../shared/domain/domain-error';
import type {
  CreateReplenishmentPlanInput,
  MobileReplenishmentPlanUpdate,
  ReplenishmentOwner,
  ReplenishmentPlan,
  ReplenishmentPlanStatus,
} from '../domain/replenishment.types';
import type { ReplenishmentRepository } from '../domain/replenishment.repository';

export class ReplenishmentValidationError extends DomainError {
  public constructor(message: string) {
    super(message, 'REPLENISHMENT_VALIDATION_FAILED');
  }
}

export class ReplenishmentService {
  public constructor(private readonly repository: ReplenishmentRepository) {}
  public create(
    input: CreateReplenishmentPlanInput,
    owner: ReplenishmentOwner,
  ) {
    validate(input);
    return this.repository.create(input, owner);
  }
  public list(owner: ReplenishmentOwner) {
    return this.repository.list(owner);
  }
  public find(id: string, owner: ReplenishmentOwner) {
    return this.repository.find(id, owner);
  }
  public setStatus(
    id: string,
    owner: ReplenishmentOwner,
    status: ReplenishmentPlanStatus,
  ) {
    if (!['ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED'].includes(status))
      throw new ReplenishmentValidationError(
        'El estado del plan no es válido.',
      );
    return this.repository.setStatus(id, owner, status);
  }
  public updateSchedule(
    id: string,
    owner: ReplenishmentOwner,
    nextReminderAt: Date,
  ) {
    if (nextReminderAt.getTime() < Date.now())
      throw new ReplenishmentValidationError(
        'El próximo recordatorio debe estar en el futuro.',
      );
    return this.repository.updateSchedule(id, owner, nextReminderAt);
  }
  public recalibrate(
    id: string,
    owner: ReplenishmentOwner,
    days: number,
    remainingBucket?: string,
    observedAt?: Date,
  ) {
    if (!Number.isInteger(days) || days < 0 || days > 365)
      throw new ReplenishmentValidationError(
        'El intervalo de recalibración no es válido.',
      );
    return this.repository.recalibrate(
      id,
      owner,
      days,
      remainingBucket,
      observedAt,
    );
  }
  public updateMobileState(
    id: string,
    owner: ReplenishmentOwner,
    input: MobileReplenishmentPlanUpdate,
  ) {
    if (
      input.status !== undefined &&
      !['ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED'].includes(input.status)
    )
      throw new ReplenishmentValidationError(
        'El estado del plan no es válido.',
      );
    if (
      input.leadDays !== undefined &&
      (!Number.isInteger(input.leadDays) ||
        input.leadDays < 0 ||
        input.leadDays > 30)
    )
      throw new ReplenishmentValidationError(
        'Los días de anticipación deben estar entre 0 y 30.',
      );
    if (input.nextReminderAt && input.nextReminderAt.getTime() < Date.now())
      throw new ReplenishmentValidationError(
        'El próximo recordatorio debe estar en el futuro.',
      );
    return this.repository.updateMobileState(id, owner, input);
  }
  public changeProduct(
    id: string,
    owner: ReplenishmentOwner,
    productId: string,
    variantId: string,
    input?: { bagStartedAt?: Date; remainingBucket?: string },
  ) {
    return this.repository.changeProduct(
      id,
      owner,
      productId,
      variantId,
      input,
    );
  }
  public startBag(
    id: string,
    owner: ReplenishmentOwner,
    input?: { orderId?: string; orderLineId?: string; startedAt?: Date },
  ) {
    return this.repository.startBag(id, owner, input);
  }
  public assertReorderable(plan: ReplenishmentPlan): ReplenishmentPlan {
    if (!['ACTIVE', 'PAUSED'].includes(plan.status))
      throw new ReplenishmentValidationError(
        'El plan no está disponible para reposición.',
      );
    return plan;
  }
  public reorder(
    id: string,
    owner: ReplenishmentOwner,
    options?: { anonymousToken?: boolean },
  ) {
    return this.repository.createReorderCart(id, owner, options);
  }
}

const validate = (input: CreateReplenishmentPlanInput) => {
  if (
    !input.petName.trim() ||
    !input.petSpecies.trim() ||
    !input.petLifeStage.trim()
  )
    throw new ReplenishmentValidationError(
      'Los datos de la mascota son obligatorios.',
    );
  if (
    !/^\d+(\.\d{1,2})?$/.test(input.petWeightKg) ||
    Number(input.petWeightKg) <= 0
  )
    throw new ReplenishmentValidationError(
      'El peso de la mascota no es válido.',
    );
  if (
    !/^\d+(\.\d{1,2})?$/.test(input.dailyConsumption) ||
    Number(input.dailyConsumption) <= 0
  )
    throw new ReplenishmentValidationError('El consumo diario no es válido.');
  if (
    input.durationDaysMin < 1 ||
    input.durationDaysMax < input.durationDaysMin
  )
    throw new ReplenishmentValidationError(
      'La duración estimada no es válida.',
    );
  if (!input.destination.trim() || !input.consentVersion.trim())
    throw new ReplenishmentValidationError(
      'El consentimiento requiere canal, destino y versión.',
    );
};
