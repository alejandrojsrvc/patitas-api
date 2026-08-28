import type {
  CreateSupplierInput,
  CreateSupplierOfferInput,
  Supplier,
  SupplierFilter,
  SupplierOffer,
  SupplierPage,
  UpdateSupplierInput,
  UpdateSupplierOfferInput,
  SupplierOfferImportRow,
  SupplierOfferImportResult,
} from '../supplier.types';

export const SUPPLIER_REPOSITORY = Symbol('SUPPLIER_REPOSITORY');

export interface SupplierOfferImportOptions {
  dryRun: boolean;
  createMissingSuppliers?: boolean;
}

export interface SupplierRepository {
  listSuppliers(filter: SupplierFilter): Promise<SupplierPage>;
  findSupplier(id: string): Promise<Supplier | null>;
  createSupplier(input: CreateSupplierInput): Promise<Supplier>;
  updateSupplier(id: string, input: UpdateSupplierInput): Promise<Supplier>;
  listOffers(filter: {
    supplierId?: string;
    variantId?: string;
    active?: boolean;
  }): Promise<SupplierOffer[]>;
  findOffer(id: string): Promise<SupplierOffer | null>;
  createOffer(input: CreateSupplierOfferInput): Promise<SupplierOffer>;
  updateOffer(
    id: string,
    input: UpdateSupplierOfferInput,
  ): Promise<SupplierOffer>;
  importOffers(
    rows: SupplierOfferImportRow[],
    options: SupplierOfferImportOptions,
  ): Promise<SupplierOfferImportResult>;
}
