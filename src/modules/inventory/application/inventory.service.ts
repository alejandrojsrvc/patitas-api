import { DomainError } from '../../../shared/domain/domain-error';
import type { InventoryRepository } from '../domain/inventory.repository';
import type {
  InventoryAdjustment,
  InventoryListFilter,
} from '../domain/inventory.types';

export class InventoryValidationError extends DomainError {
  public constructor(message: string) {
    super(message, 'INVENTORY_VALIDATION_FAILED');
  }
}
export class InventoryService {
  public constructor(private readonly repository: InventoryRepository) {}
  public list(filter: InventoryListFilter) {
    return this.repository.list(filter);
  }
  public adjust(input: InventoryAdjustment, actorUserId?: string) {
    if (!Number.isInteger(input.quantityDelta) || input.quantityDelta === 0)
      throw new InventoryValidationError(
        'quantityDelta debe ser un entero distinto de cero.',
      );
    if (!input.reason.trim())
      throw new InventoryValidationError(
        'El motivo del ajuste es obligatorio.',
      );
    return this.repository.adjust(
      { ...input, reason: input.reason.trim() },
      actorUserId,
    );
  }
}
