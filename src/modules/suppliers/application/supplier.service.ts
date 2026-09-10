import { DomainError } from '../../../shared/domain/domain-error';
import { parseSupplierOffersCsv } from './supplier-offers-csv';
import type { SupplierOfferImportOptions, SupplierRepository } from '../domain/repositories/supplier.repository';
import type {
  CreateSupplierInput,
  CreateSupplierOfferInput,
  UpdateSupplierInput,
  UpdateSupplierOfferInput,
  SupplierFilter,
  SupplierOfferImportRow,
} from '../domain/supplier.types';
import type { CatalogCacheInvalidationPort } from '../../../shared/application/ports/catalog-cache-invalidation.port';

export class SupplierValidationError extends DomainError {
  public constructor(message: string) {
    super(message, 'SUPPLIER_VALIDATION_FAILED');
  }
}

export class SupplierNotFoundError extends DomainError {
  public constructor(message: string) {
    super(message, 'SUPPLIER_NOT_FOUND');
  }
}

export class SupplierConflictError extends DomainError {
  public constructor(message: string) {
    super(message, 'SUPPLIER_CONFLICT');
  }
}

export class SupplierService {
  public constructor(
    private readonly repository: SupplierRepository,
    private readonly cacheInvalidation?: CatalogCacheInvalidationPort,
  ) {}

  public listSuppliers(filter: SupplierFilter) {
    return this.repository.listSuppliers(filter);
  }
  public listAllSuppliers() {
    return this.repository.listAllSuppliers();
  }
  public async findSupplier(id: string) {
    const supplier = await this.repository.findSupplier(id);
    if (!supplier) throw new SupplierNotFoundError('El proveedor no existe.');
    return supplier;
  }
  public createSupplier(input: CreateSupplierInput) {
    if (!input.name.trim()) throw new SupplierValidationError('El nombre es obligatorio.');
    return this.repository.createSupplier({
      ...input,
      name: input.name.trim(),
    });
  }
  public updateSupplier(id: string, input: UpdateSupplierInput) {
    if (input.name !== undefined && !input.name.trim()) {
      throw new SupplierValidationError('El nombre es obligatorio.');
    }
    return this.repository.updateSupplier(id, {
      ...input,
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    });
  }
  public listOffers(filter: { supplierId?: string; variantId?: string; active?: boolean }) {
    return this.repository.listOffers(filter);
  }
  public listAllOffers() {
    return this.repository.listAllOffers();
  }
  public async findOffer(id: string) {
    const offer = await this.repository.findOffer(id);
    if (!offer) throw new SupplierNotFoundError('La oferta no existe.');
    return offer;
  }
  public async createOffer(input: CreateSupplierOfferInput) {
    validateOffer(input);
    const offer = await this.repository.createOffer(input);
    this.invalidateCatalogCache();
    return offer;
  }
  public async updateOffer(id: string, input: UpdateSupplierOfferInput) {
    validateOffer(input);
    const offer = await this.repository.updateOffer(id, input);
    this.invalidateCatalogCache();
    return offer;
  }
  public importOffers(data: Uint8Array, options: SupplierOfferImportOptions) {
    let rows: SupplierOfferImportRow[];
    try {
      rows = parseSupplierOffersCsv(data);
    } catch (error) {
      throw new SupplierValidationError(error instanceof Error ? error.message : 'El CSV no es válido.');
    }
    return this.importOfferRows(rows, options);
  }
  public async importOfferRows(rows: SupplierOfferImportRow[], options: SupplierOfferImportOptions) {
    const result = await this.repository.importOffers(rows, options);
    if (!options.dryRun) this.invalidateCatalogCache();
    return result;
  }

  private invalidateCatalogCache(): void {
    if (!this.cacheInvalidation) return;
    void this.cacheInvalidation.invalidate({ scope: 'catalog' }).catch(() => undefined);
  }
}

const validateOffer = (input: UpdateSupplierOfferInput | CreateSupplierOfferInput) => {
  if (input.unitCost !== undefined && Number(input.unitCost) <= 0) {
    throw new SupplierValidationError('El costo unitario debe ser mayor que cero.');
  }
  if (input.minimumQuantity !== undefined && input.minimumQuantity < 1) {
    throw new SupplierValidationError('La cantidad mínima debe ser al menos uno.');
  }
  if (input.leadTimeHours !== undefined && input.leadTimeHours !== null && input.leadTimeHours < 0) {
    throw new SupplierValidationError('El lead time no puede ser negativo.');
  }
};
