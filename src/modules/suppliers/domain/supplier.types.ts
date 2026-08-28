export type SupplierOfferStockStatus =
  'AVAILABLE' | 'OUT_OF_STOCK' | 'ON_REQUEST' | 'UNKNOWN';

export interface Supplier {
  id: string;
  name: string;
  active: boolean;
}

export interface SupplierFilter {
  q?: string;
  active?: boolean;
  page: number;
  perPage: number;
}

export interface SupplierPage {
  items: Supplier[];
  page: number;
  perPage: number;
  total: number;
}

export interface SupplierOffer {
  id: string;
  supplierId: string;
  variantId: string;
  supplierSku: string | null;
  unitCost: string;
  currency: 'ARS';
  stockStatus: SupplierOfferStockStatus;
  leadTimeHours: number | null;
  minimumQuantity: number;
  active: boolean;
  revision: number;
  updatedAt: Date;
}

export interface CreateSupplierInput {
  name: string;
  active?: boolean;
}
export interface UpdateSupplierInput {
  name?: string;
  active?: boolean;
}
export interface CreateSupplierOfferInput {
  supplierId: string;
  variantId: string;
  supplierSku?: string | null;
  unitCost: string;
  stockStatus?: SupplierOfferStockStatus;
  leadTimeHours?: number | null;
  minimumQuantity?: number;
  active?: boolean;
}
export type UpdateSupplierOfferInput = Partial<
  Omit<CreateSupplierOfferInput, 'supplierId' | 'variantId'>
>;

export interface SupplierOfferImportRow {
  rowNumber: number;
  supplierId: string | null;
  supplierName: string | null;
  variantId: string | null;
  sku: string | null;
  barcode: string | null;
  supplierSku: string | null;
  unitCost: string;
  stockStatus: SupplierOfferStockStatus;
  leadTimeHours: number | null;
  minimumQuantity: number;
  active: boolean;
}

export interface SupplierOfferImportError {
  row: number;
  message: string;
}

export interface SupplierOfferImportResult {
  total: number;
  created: number;
  updated: number;
  errors: SupplierOfferImportError[];
  dryRun: boolean;
}
