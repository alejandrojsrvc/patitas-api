import { DomainError } from '../../../shared/domain/domain-error';
import type { InventoryRepository } from '../domain/inventory.repository';
import type { InventoryAdjustment, InventoryListFilter } from '../domain/inventory.types';
import type { CatalogCacheInvalidationPort } from '../../../shared/application/ports/catalog-cache-invalidation.port';

export class InventoryValidationError extends DomainError {
  public constructor(message: string) {
    super(message, 'INVENTORY_VALIDATION_FAILED');
  }
}
export class InventoryService {
  public constructor(
    private readonly repository: InventoryRepository,
    private readonly cacheInvalidation?: CatalogCacheInvalidationPort,
  ) {}
  public list(filter: InventoryListFilter) {
    return this.repository.list(filter);
  }
  public async adjust(input: InventoryAdjustment, actorUserId?: string) {
    if (!Number.isInteger(input.quantityDelta) || input.quantityDelta === 0)
      throw new InventoryValidationError('quantityDelta debe ser un entero distinto de cero.');
    if (!input.reason.trim()) throw new InventoryValidationError('El motivo del ajuste es obligatorio.');
    const inventory = await this.repository.adjust({ ...input, reason: input.reason.trim() }, actorUserId);
    if (this.cacheInvalidation) void this.cacheInvalidation.invalidate({ scope: 'products' }).catch(() => undefined);
    return inventory;
  }
}
