import type {
  Product,
  ProductVariant,
  VariantFulfillment,
} from '../../catalog/domain/catalog.types';
import type {
  FulfillmentRepository,
  FulfillmentSettingsInput,
} from '../domain/fulfillment.types';

export class FulfillmentValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'FulfillmentValidationError';
  }
}

export class FulfillmentService {
  public constructor(private readonly repository: FulfillmentRepository) {}

  public getSettings() {
    return this.repository.getSettings();
  }

  public updateSettings(input: FulfillmentSettingsInput) {
    if (input.depotCutoff !== undefined && !isTime(input.depotCutoff))
      throw new FulfillmentValidationError(
        'El corte del depósito no es válido.',
      );
    if (
      input.depotHandlingMinutes !== undefined &&
      (!Number.isInteger(input.depotHandlingMinutes) ||
        input.depotHandlingMinutes < 0)
    )
      throw new FulfillmentValidationError(
        'El tiempo de preparación debe ser un entero no negativo.',
      );
    if (input.timezone !== undefined && !input.timezone.trim())
      throw new FulfillmentValidationError('La zona horaria es obligatoria.');
    return this.repository.updateSettings({
      ...input,
      timezone: input.timezone?.trim(),
    });
  }

  public async enrichProduct(
    product: Product,
    now = new Date(),
    settings?: Awaited<ReturnType<FulfillmentRepository['getSettings']>>,
  ): Promise<Product> {
    const resolvedSettings = settings ?? (await this.repository.getSettings());
    return {
      ...product,
      variants: product.variants.map((variant) => ({
        ...variant,
        fulfillment: calculateVariantFulfillment(
          variant,
          resolvedSettings,
          now,
        ),
      })),
    };
  }
}

export const calculateVariantFulfillment = (
  variant: ProductVariant,
  settings: Awaited<ReturnType<FulfillmentRepository['getSettings']>>,
  now: Date,
): VariantFulfillment => {
  const available = Math.max(0, variant.availableQuantity);
  const supplierMode = variant.supplierFulfillmentMode ?? null;
  const supplierCutoff = variant.supplierCutoff ?? null;
  const supplierToDepotMinutes = variant.supplierToDepotMinutes ?? null;
  const supplierFulfillmentCost = variant.supplierFulfillmentCost ?? null;
  const beforeDepotCutoff = isBeforeCutoff(
    now,
    settings.depotCutoff,
    settings.timezone,
  );
  if (available > 0) {
    const today = settings.sameDayEnabled && beforeDepotCutoff;
    return {
      status: 'IN_STOCK',
      purchasable: true,
      availability: today ? 'TODAY' : 'TOMORROW',
      label: today ? 'Entrega hoy' : 'Entrega mañana',
      availableQuantity: available,
      source: 'OWN_STOCK',
      orderBefore: today ? settings.depotCutoff : null,
      deliveryDate: dateOnly(now, today ? 0 : 1, settings.timezone),
      supplierFulfillmentCost: null,
    };
  }

  const supplierAvailable = ['AVAILABLE', 'ON_REQUEST'].includes(
    variant.supplierStockStatus ?? '',
  );
  const express =
    supplierAvailable &&
    supplierMode === 'EXPRESS' &&
    supplierCutoff !== null &&
    supplierToDepotMinutes !== null &&
    variant.supplierLeadTimeHours !== null &&
    variant.supplierLeadTimeHours <= 24 &&
    isBeforeCutoff(now, supplierCutoff, settings.timezone) &&
    beforeDepotCutoff &&
    minutesUntilCutoff(now, settings.depotCutoff, settings.timezone) >=
      supplierToDepotMinutes + settings.depotHandlingMinutes;
  if (express) {
    return {
      status: 'SUPPLIER_EXPRESS',
      purchasable: true,
      availability: 'TODAY',
      label: 'Disponible para entrega hoy',
      availableQuantity: 0,
      source: 'SUPPLIER_EXPRESS',
      orderBefore: supplierCutoff,
      deliveryDate: dateOnly(now, 0, settings.timezone),
      supplierFulfillmentCost,
    };
  }

  if (supplierAvailable && variant.supplierLeadTimeHours !== null) {
    const days = Math.max(1, Math.ceil(variant.supplierLeadTimeHours / 24));
    return {
      status: 'SUPPLIER_STANDARD',
      purchasable: true,
      availability: days <= 1 ? 'TOMORROW' : 'LATER',
      label: days <= 1 ? 'Disponible mañana' : `Disponible en ${days} días`,
      availableQuantity: 0,
      source: 'SUPPLIER_STANDARD',
      orderBefore: null,
      deliveryDate: dateOnly(now, days, settings.timezone),
      supplierFulfillmentCost,
    };
  }

  return {
    status: 'OUT_OF_STOCK',
    purchasable: false,
    availability: 'OUT_OF_STOCK',
    label: 'Agotado',
    availableQuantity: 0,
    source: null,
    orderBefore: null,
    deliveryDate: null,
    supplierFulfillmentCost: null,
  };
};

const isBeforeCutoff = (now: Date, cutoff: string, timezone: string) =>
  minutesInTimezone(now, timezone) < timeToMinutes(cutoff);

const minutesUntilCutoff = (now: Date, cutoff: string, timezone: string) =>
  timeToMinutes(cutoff) - minutesInTimezone(now, timezone);

const minutesInTimezone = (date: Date, timezone: string): number => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === 'minute')?.value ?? 0,
  );
  return hour * 60 + minute;
};

const timeToMinutes = (value: string): number => {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
};

const dateOnly = (date: Date, days: number, timezone: string): string => {
  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  const result = new Date(`${localDate}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
};

const isTime = (value: string): boolean =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
