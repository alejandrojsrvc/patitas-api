import { DomainError } from '../../../shared/domain/domain-error';
import type { SupplierRepository } from '../domain/repositories/supplier.repository';
import type {
  CreateSupplierInput,
  CreateSupplierOfferInput,
  UpdateSupplierInput,
  UpdateSupplierOfferInput,
  SupplierFilter,
} from '../domain/supplier.types';

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
  public constructor(private readonly repository: SupplierRepository) {}

  public listSuppliers(filter: SupplierFilter) {
    return this.repository.listSuppliers(filter);
  }
  public async findSupplier(id: string) {
    const supplier = await this.repository.findSupplier(id);
    if (!supplier) throw new SupplierNotFoundError('El proveedor no existe.');
    return supplier;
  }
  public createSupplier(input: CreateSupplierInput) {
    if (!input.name.trim())
      throw new SupplierValidationError('El nombre es obligatorio.');
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
  public listOffers(filter: {
    supplierId?: string;
    variantId?: string;
    active?: boolean;
  }) {
    return this.repository.listOffers(filter);
  }
  public async findOffer(id: string) {
    const offer = await this.repository.findOffer(id);
    if (!offer) throw new SupplierNotFoundError('La oferta no existe.');
    return offer;
  }
  public createOffer(input: CreateSupplierOfferInput) {
    validateOffer(input);
    return this.repository.createOffer(input);
  }
  public updateOffer(id: string, input: UpdateSupplierOfferInput) {
    validateOffer(input);
    return this.repository.updateOffer(id, input);
  }
}

const validateOffer = (
  input: UpdateSupplierOfferInput | CreateSupplierOfferInput,
) => {
  if (input.unitCost !== undefined && Number(input.unitCost) <= 0) {
    throw new SupplierValidationError(
      'El costo unitario debe ser mayor que cero.',
    );
  }
  if (input.minimumQuantity !== undefined && input.minimumQuantity < 1) {
    throw new SupplierValidationError(
      'La cantidad mínima debe ser al menos uno.',
    );
  }
  if (
    input.leadTimeHours !== undefined &&
    input.leadTimeHours !== null &&
    input.leadTimeHours < 0
  ) {
    throw new SupplierValidationError('El lead time no puede ser negativo.');
  }
};
