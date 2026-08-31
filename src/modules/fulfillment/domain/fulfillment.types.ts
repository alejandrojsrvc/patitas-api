import type {
  Product,
  ProductVariant,
  SupplierFulfillmentMode,
} from '../../catalog/domain/catalog.types';

export interface FulfillmentSettings {
  id: string;
  timezone: string;
  depotCutoff: string;
  sameDayEnabled: boolean;
  depotHandlingMinutes: number;
  updatedAt: Date;
}

export interface FulfillmentSettingsInput {
  timezone?: string;
  depotCutoff?: string;
  sameDayEnabled?: boolean;
  depotHandlingMinutes?: number;
}

export interface FulfillmentRepository {
  getSettings(): Promise<FulfillmentSettings>;
  updateSettings(input: FulfillmentSettingsInput): Promise<FulfillmentSettings>;
}

export const FULFILLMENT_REPOSITORY = Symbol('FULFILLMENT_REPOSITORY');

export interface FulfillmentVariantInput {
  availableQuantity: number;
  supplierStockStatus: ProductVariant['supplierStockStatus'];
  supplierLeadTimeHours: number | null;
  supplierFulfillmentMode: SupplierFulfillmentMode | null;
  supplierCutoff: string | null;
  supplierToDepotMinutes: number | null;
  supplierFulfillmentCost: string | null;
}

export type FulfilledProduct = Product;
