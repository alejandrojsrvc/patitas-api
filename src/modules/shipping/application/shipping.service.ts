import { DomainError } from '../../../shared/domain/domain-error';
import type { ShippingRepository } from '../domain/shipping.repository';
import type {
  ShippingOptionInput,
  ShippingZoneInput,
} from '../domain/shipping.types';

export class ShippingValidationError extends DomainError {
  public constructor(message: string) {
    super(message, 'SHIPPING_VALIDATION_FAILED');
  }
}

export class ShippingService {
  public constructor(private readonly repository: ShippingRepository) {}
  public list(activeOnly = false) {
    return this.repository.list(activeOnly);
  }
  public find(id: string) {
    return this.repository.find(id);
  }
  public create(input: ShippingOptionInput) {
    validate(input);
    return this.repository.create(normalize(input));
  }
  public update(id: string, input: Partial<ShippingOptionInput>) {
    validate(input);
    return this.repository.update(id, normalize(input));
  }
  public listZones(activeOnly = false) {
    return this.repository.listZones(activeOnly);
  }
  public createZone(input: ShippingZoneInput) {
    validateZone(input);
    return this.repository.createZone(normalizeZone(input));
  }
  public updateZone(id: string, input: Partial<ShippingZoneInput>) {
    validateZone(input);
    return this.repository.updateZone(id, normalizeZone(input));
  }
  public quote(input: {
    postalCode?: string;
    neighborhood?: string;
    subtotal: string;
    weightGrams?: number;
  }) {
    if (!input.postalCode && !input.neighborhood)
      throw new ShippingValidationError(
        'Indica código postal o barrio para calcular la cobertura.',
      );
    return this.repository.quote(input);
  }
}

const validate = (input: Partial<ShippingOptionInput>) => {
  if (input.name !== undefined && !input.name.trim())
    throw new ShippingValidationError('El nombre del envío es obligatorio.');
  if (
    input.cost !== undefined &&
    (!/^\d+(\.\d{1,2})?$/.test(input.cost) || Number(input.cost) < 0)
  )
    throw new ShippingValidationError('El costo del envío no es válido.');
};
const normalize = <
  T extends ShippingOptionInput | Partial<ShippingOptionInput>,
>(
  input: T,
): T => ({
  ...input,
  ...(input.name !== undefined ? { name: input.name.trim() } : {}),
});
const validateZone = (input: Partial<ShippingZoneInput>) => {
  if (input.name !== undefined && !input.name.trim())
    throw new ShippingValidationError('El nombre de la zona es obligatorio.');
  if (
    input.cost !== undefined &&
    (!/^\d+(\.\d{1,2})?$/.test(input.cost) || Number(input.cost) < 0)
  )
    throw new ShippingValidationError('El costo de la zona no es válido.');
  if (input.estimatedDaysMin !== undefined && input.estimatedDaysMin < 0)
    throw new ShippingValidationError('El plazo mínimo no es válido.');
  if (input.estimatedDaysMax !== undefined && input.estimatedDaysMax < 0)
    throw new ShippingValidationError('El plazo máximo no es válido.');
};
const normalizeZone = <
  T extends ShippingZoneInput | Partial<ShippingZoneInput>,
>(
  input: T,
): T => ({
  ...input,
  ...(input.name !== undefined ? { name: input.name.trim() } : {}),
  ...(input.postalCodes
    ? {
        postalCodes: input.postalCodes.map((value) =>
          value.trim().toUpperCase(),
        ),
      }
    : {}),
  ...(input.neighborhoods
    ? {
        neighborhoods: input.neighborhoods.map((value) =>
          value.trim().toLowerCase(),
        ),
      }
    : {}),
});
