import type { ShippingOption, ShippingOptionInput, ShippingQuote, ShippingZone, ShippingZoneInput } from './shipping.types';

export const SHIPPING_REPOSITORY = Symbol('SHIPPING_REPOSITORY');

export interface ShippingRepository {
  list(activeOnly?: boolean): Promise<ShippingOption[]>;
  find(id: string): Promise<ShippingOption | null>;
  create(input: ShippingOptionInput): Promise<ShippingOption>;
  update(id: string, input: Partial<ShippingOptionInput>): Promise<ShippingOption>;
  listZones(activeOnly?: boolean): Promise<ShippingZone[]>;
  createZone(input: ShippingZoneInput): Promise<ShippingZone>;
  updateZone(id: string, input: Partial<ShippingZoneInput>): Promise<ShippingZone>;
  quote(input: { postalCode?: string; neighborhood?: string; subtotal: string; weightGrams?: number }): Promise<ShippingQuote>;
}
