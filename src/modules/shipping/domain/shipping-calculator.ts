import type { ShippingZone } from './shipping.types';

export const SHIPPING_VAT_PERCENT = 21;
export const SHIPPING_STANDARD_WEIGHT_GRAMS = 20_000;
export const SHIPPING_MAX_WEIGHT_GRAMS = 30_000;

export interface ShippingCalculationInput {
  postalCode?: string;
  neighborhood?: string;
  city?: string;
  province?: string;
  weightGrams?: number;
  subtotal: string;
  stockAvailable?: boolean;
  now?: Date;
}

export interface ShippingCutoff {
  time: string;
  coverage: 'AMBA' | 'CABA';
}

export interface ShippingDeliverySlot {
  id: string;
  label: string;
  start: string;
  end: string;
  date: string;
}

export interface ShippingQuote {
  available: boolean;
  zoneId: string | null;
  zoneName: string | null;
  providerCost: string;
  tariff: string;
  vat: string;
  subsidy: string;
  cost: string;
  deliveryCount: number;
  estimate: string | null;
  cutoffs: ShippingCutoff[];
  deliverySlots: ShippingDeliverySlot[];
  freeShippingFrom: string | null;
  eligibleAmount: string;
  remainingForFreeShipping: string | null;
  reasonCode: string | null;
  message: string;
}

export const calculateShipping = (zones: ShippingZone[], input: ShippingCalculationInput, subsidy: string): ShippingQuote => {
  if (input.weightGrams === undefined || !Number.isInteger(input.weightGrams) || input.weightGrams <= 0)
    return unavailable('WEIGHT_UNAVAILABLE', 'No se puede calcular el envío porque falta un peso logístico válido.');
  if (input.stockAvailable === false) return unavailable('OUT_OF_STOCK', 'No hay stock disponible para todos los productos.');
  if (input.weightGrams > SHIPPING_MAX_WEIGHT_GRAMS)
    return unavailable('WEIGHT_LIMIT_EXCEEDED', 'El peso supera el máximo permitido para la entrega.');

  const zone = zones.find((candidate) => matchesZone(candidate, input));
  if (!zone) return unavailable('OUT_OF_COVERAGE', 'La dirección está fuera de cobertura.');
  if (zone.maxWeightGrams !== null && input.weightGrams > zone.maxWeightGrams)
    return unavailable('WEIGHT_LIMIT_EXCEEDED', 'El peso supera el máximo permitido para la zona.');

  const deliveryCount = input.weightGrams > SHIPPING_STANDARD_WEIGHT_GRAMS ? 2 : 1;
  const baseCents = moneyToCents(zone.cost);
  const freeShippingFrom = zone.freeShippingFrom === null ? null : moneyToCents(zone.freeShippingFrom);
  const subtotalCents = moneyToCents(input.subtotal);
  const providerCostCents = roundCents(baseCents * BigInt(deliveryCount), SHIPPING_VAT_PERCENT);
  const subsidyCents = min(moneyToCents(subsidy), providerCostCents);
  const costCents = providerCostCents - subsidyCents;
  const remainingForFreeShipping =
    freeShippingFrom === null ? null : freeShippingFrom > subtotalCents ? centsToMoney(freeShippingFrom - subtotalCents) : '0.00';
  const deliverySlots = readDeliverySlots(zone.deliveryWindows, input.now ?? new Date(), zone.region);
  if (!deliverySlots.length) return unavailable('DELIVERY_CONFIGURATION_UNAVAILABLE', 'No hay fechas de entrega disponibles para esta zona.');

  return {
    available: true,
    zoneId: zone.id,
    zoneName: zone.name,
    providerCost: centsToMoney(providerCostCents),
    tariff: zone.cost,
    vat: centsToMoney(providerCostCents - baseCents * BigInt(deliveryCount)),
    subsidy: centsToMoney(subsidyCents),
    cost: centsToMoney(costCents),
    deliveryCount,
    estimate: deliveryEstimate(zone, deliverySlots, input.now ?? new Date()),
    cutoffs: readCutoffs(zone.deliveryWindows),
    deliverySlots,
    freeShippingFrom: zone.freeShippingFrom,
    eligibleAmount: centsToMoney(subtotalCents),
    remainingForFreeShipping,
    reasonCode: null,
    message: 'Envío disponible.',
  };
};

const matchesZone = (zone: ShippingZone, input: ShippingCalculationInput): boolean => {
  const postalCode = normalize(input.postalCode);
  const locations = [input.neighborhood, input.city, input.province].map(normalize).filter((value): value is string => Boolean(value));

  return (
    (postalCode !== null &&
      (zone.postalCodes.some((value) => normalize(value) === postalCode) || matchesPostalCodeRange(zone.deliveryWindows, postalCode))) ||
    locations.some((location) => zone.neighborhoods.some((value) => normalize(value) === location))
  );
};

const matchesPostalCodeRange = (value: unknown, postalCode: string): boolean => {
  const numericPostalCode = Number(postalCode.replace(/^c/i, ''));
  if (!Number.isInteger(numericPostalCode)) return false;
  if (!value || typeof value !== 'object') return false;
  const ranges = (value as { postalCodeRanges?: unknown }).postalCodeRanges;
  if (!Array.isArray(ranges)) return false;
  return ranges.some((range) => {
    if (!range || typeof range !== 'object') return false;
    const candidate = range as Record<string, unknown>;
    return (
      Number.isInteger(Number(candidate.min)) &&
      Number.isInteger(Number(candidate.max)) &&
      numericPostalCode >= Number(candidate.min) &&
      numericPostalCode <= Number(candidate.max)
    );
  });
};

const readCutoffs = (value: unknown): ShippingCutoff[] => {
  if (!value || typeof value !== 'object') return [];
  const cutoffs = (value as { collectionCutoffs?: unknown }).collectionCutoffs;
  if (!Array.isArray(cutoffs)) return [];
  return cutoffs.filter(isCutoff);
};

const readDeliverySlots = (value: unknown, now: Date, region: 'AMBA' | 'CABA'): ShippingDeliverySlot[] => {
  const config = deliveryWindowConfig(value, region);
  if (!config) return [];
  const local = localDateTime(now, config.timezone);
  const currentMinutes = local.hour * 60 + local.minute;
  const dates: string[] = [];
  if (config.daysOfWeek.includes(local.weekday) && currentMinutes <= (timeToMinutes(config.cutoff) ?? 0)) dates.push(local.date);
  const cursor = new Date(`${local.date}T00:00:00Z`);
  for (let offset = 1; dates.length < 7 && offset <= 14; offset += 1) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = ((local.weekday - 1 + offset) % 7) + 1;
    if (config.daysOfWeek.includes(weekday)) dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates.flatMap((date) => config.slots.map((slot) => ({ ...slot, date })));
};

const deliveryWindowConfig = (
  value: unknown,
  region: 'AMBA' | 'CABA',
): {
  slots: Array<Omit<ShippingDeliverySlot, 'date'>>;
  daysOfWeek: number[];
  cutoff: string;
  timezone: string;
} | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const rawSlots = record.deliverySlots;
  if (!Array.isArray(rawSlots)) return null;
  const slots = rawSlots.filter(isDeliverySlot);
  if (slots.length < 1 || slots.length > 6) return null;
  const daysOfWeek = Array.isArray(record.daysOfWeek)
    ? record.daysOfWeek.filter((day): day is number => Number.isInteger(day) && day >= 1 && day <= 7)
    : [1, 2, 3, 4, 5];
  const cutoffs = Array.isArray(record.collectionCutoffs) ? record.collectionCutoffs.filter(isCutoff) : [];
  const selectedCutoff = cutoffs.find((item) => item.coverage === region);
  const cutoff = selectedCutoff?.time ?? (typeof record.cutoff === 'string' ? record.cutoff : '13:00');
  const timezone = typeof record.timezone === 'string' ? record.timezone : 'America/Argentina/Buenos_Aires';
  if (timeToMinutes(cutoff) === null || daysOfWeek.length === 0) return null;
  return { slots, daysOfWeek, cutoff, timezone };
};

const isDeliverySlot = (value: unknown): value is Omit<ShippingDeliverySlot, 'date'> => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  const start = typeof candidate.start === 'string' ? timeToMinutes(candidate.start) : null;
  const end = typeof candidate.end === 'string' ? timeToMinutes(candidate.end) : null;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.label === 'string' &&
    typeof candidate.start === 'string' &&
    typeof candidate.end === 'string' &&
    start !== null &&
    end !== null &&
    start < end
  );
};

const deliveryEstimate = (zone: ShippingZone, slots: ShippingDeliverySlot[], now: Date): string => {
  if (!slots.length) return `${zone.estimatedDaysMin}-${zone.estimatedDaysMax} días hábiles`;
  const timezone = deliveryWindowConfig(zone.deliveryWindows, zone.region)?.timezone ?? 'America/Argentina/Buenos_Aires';
  const today = localDateTime(now, timezone).date;
  return slots[0].date === today ? 'Entrega hoy' : 'Entrega el siguiente día hábil';
};

const localDateTime = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  const weekday = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[value('weekday') ?? 'Sun'] ?? 7;
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    weekday,
    hour: Number(value('hour') ?? 24),
    minute: Number(value('minute') ?? 60),
  };
};

const timeToMinutes = (value: string): number | null => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
};

const isCutoff = (value: unknown): value is ShippingCutoff => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.time === 'string' && (candidate.coverage === 'AMBA' || candidate.coverage === 'CABA');
};

const unavailable = (reasonCode: string, message: string): ShippingQuote => ({
  available: false,
  zoneId: null,
  zoneName: null,
  providerCost: '0.00',
  tariff: '0.00',
  vat: '0.00',
  subsidy: '0.00',
  cost: '0.00',
  deliveryCount: 0,
  estimate: null,
  cutoffs: [],
  deliverySlots: [],
  freeShippingFrom: null,
  eligibleAmount: '0.00',
  remainingForFreeShipping: null,
  reasonCode,
  message,
});

const normalize = (value?: string): string | null => {
  const normalized = value
    ?.trim()
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return normalized || null;
};

const moneyToCents = (value: string): bigint => {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return 0n;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
};

const roundCents = (cents: bigint, percent: number): bigint => (cents * BigInt(100 + percent) + 50n) / 100n;

const centsToMoney = (cents: bigint): string => {
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, '0');
  return `${whole}.${fraction}`;
};

const min = (left: bigint, right: bigint): bigint => (left < right ? left : right);
