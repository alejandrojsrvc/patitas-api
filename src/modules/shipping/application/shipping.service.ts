import { DomainError } from '../../../shared/domain/domain-error';
import type { ShippingRepository } from '../domain/shipping.repository';
import type {
  ShippingOptionInput,
  ShippingOptionQuote,
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
  public quoteOptions(input: {
    postalCode?: string;
    neighborhood?: string;
    city?: string;
    province?: string;
    subtotal: string;
    weightGrams?: number;
    stockAvailable?: boolean;
  }): Promise<ShippingOptionQuote[]> {
    return this.repository.quoteOptions(input);
  }
  public createZone(input: ShippingZoneInput) {
    validateZone(input);
    if (input.deliveryWindows !== undefined)
      validateDeliveryWindows(input.deliveryWindows);
    return this.repository.createZone(normalizeZone(input));
  }
  public updateZone(id: string, input: Partial<ShippingZoneInput>) {
    validateZone(input);
    if (input.deliveryWindows !== undefined)
      validateDeliveryWindows(input.deliveryWindows);
    return this.repository.updateZone(id, normalizeZone(input));
  }
  public quote(input: {
    postalCode?: string;
    neighborhood?: string;
    city?: string;
    province?: string;
    subtotal: string;
    weightGrams?: number;
    stockAvailable?: boolean;
  }) {
    if (!input.postalCode && !input.neighborhood && !input.city)
      throw new ShippingValidationError(
        'Indica código postal, localidad o barrio para calcular la cobertura.',
      );
    const subtotal = Number(input.subtotal);
    if (!Number.isFinite(subtotal) || subtotal < 0 || subtotal > 100_000_000)
      throw new ShippingValidationError('El subtotal no es válido.');
    if (
      input.weightGrams !== undefined &&
      (!Number.isFinite(input.weightGrams) ||
        input.weightGrams < 0 ||
        input.weightGrams > 1_000_000)
    )
      throw new ShippingValidationError('El peso no es válido.');
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
const validateDeliveryWindows = (value: unknown) => {
  if (!value || typeof value !== 'object')
    throw new ShippingValidationError('La configuración horaria no es válida.');
  const record = value as Record<string, unknown>;
  const slots = record.deliverySlots;
  if (!Array.isArray(slots) || slots.length < 1 || slots.length > 6)
    throw new ShippingValidationError(
      'La configuración debe contener entre una y seis franjas.',
    );
  if (
    slots.some((slot) => {
      if (!slot || typeof slot !== 'object') return true;
      const item = slot as Record<string, unknown>;
      return (
        typeof item.id !== 'string' ||
        typeof item.label !== 'string' ||
        !isTime(item.start) ||
        !isTime(item.end) ||
        timeToMinutes(item.start) >= timeToMinutes(item.end)
      );
    })
  )
    throw new ShippingValidationError('Las franjas horarias no son válidas.');
  if (
    !Array.isArray(record.daysOfWeek) ||
    record.daysOfWeek.some(
      (day) => !Number.isInteger(day) || Number(day) < 1 || Number(day) > 7,
    ) ||
    !isTime(record.cutoff)
  )
    throw new ShippingValidationError(
      'Los días y el corte horario no son válidos.',
    );
};
const isTime = (value: unknown): value is string =>
  typeof value === 'string' && /^(\d{2}):([0-5]\d)$/.test(value);
const timeToMinutes = (value: string): number => {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
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
