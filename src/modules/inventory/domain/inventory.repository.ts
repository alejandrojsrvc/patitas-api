import type {
  InventoryAdjustment,
  InventoryListFilter,
  InventoryPage,
  InventoryRow,
} from './inventory.types';

export const INVENTORY_REPOSITORY = Symbol('INVENTORY_REPOSITORY');
export interface InventoryRepository {
  list(filter: InventoryListFilter): Promise<InventoryPage>;
  adjust(
    input: InventoryAdjustment,
    actorUserId?: string,
  ): Promise<InventoryRow>;
}
