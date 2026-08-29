import type {
  ShippingOption,
  ShippingOptionInput,
  ShippingOptionQuote,
  ShippingQuote,
  ShippingZone,
  ShippingZoneInput,
} from './shipping.types';

export const SHIPPING_REPOSITORY = Symbol('SHIPPING_REPOSITORY');

export interface ShippingRepository {
  list(activeOnly?: boolean): Promise<ShippingOption[]>;
  find(id: string): Promise<ShippingOption | null>;
  create(input: ShippingOptionInput): Promise<ShippingOption>;
  update(
    id: string,
    input: Partial<ShippingOptionInput>,
  ): Promise<ShippingOption>;
  listZones(activeOnly?: boolean): Promise<ShippingZone[]>;
  quoteOptions(input: {
    postalCode?: string;
    neighborhood?: string;
    city?: string;
    province?: string;
    subtotal: string;
    weightGrams?: number;
    stockAvailable?: boolean;
  }): Promise<ShippingOptionQuote[]>;
  createZone(input: ShippingZoneInput): Promise<ShippingZone>;
  updateZone(
    id: string,
    input: Partial<ShippingZoneInput>,
  ): Promise<ShippingZone>;
  quote(input: {
    postalCode?: string;
    neighborhood?: string;
    city?: string;
    province?: string;
    subtotal: string;
    weightGrams?: number;
    stockAvailable?: boolean;
  }): Promise<ShippingQuote>;
}
