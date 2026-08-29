export interface ShippingOption {
  id: string;
  name: string;
  description: string | null;
  cost: string;
  active: boolean;
  displayOrder: number;
}

export interface ShippingOptionInput {
  name: string;
  description?: string | null;
  cost: string;
  active?: boolean;
  displayOrder?: number;
}

export interface ShippingOptionQuote extends ShippingOption {
  cost: string;
  providerCost: string;
  vat: string;
  subsidy: string;
  deliveryCount: number;
  zoneId: string | null;
  zoneName: string | null;
  estimate: string | null;
  cutoffs: Array<{ time: string; coverage: 'AMBA' | 'CABA' }>;
  deliverySlots: Array<{
    id: string;
    label: string;
    start: string;
    end: string;
    date: string;
  }>;
  available: boolean;
  message: string;
}

export type ShippingQuote = import('./shipping-calculator').ShippingQuote;

export type ShippingCoverageType = 'POSTAL_CODE' | 'NEIGHBORHOOD' | 'POLYGON';

export interface ShippingZone {
  id: string;
  name: string;
  type: ShippingCoverageType;
  active: boolean;
  priority: number;
  postalCodes: string[];
  neighborhoods: string[];
  polygon: unknown;
  cost: string;
  freeShippingFrom: string | null;
  maxWeightGrams: number | null;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  deliveryWindows: unknown;
}

export interface ShippingZoneInput {
  name: string;
  type: ShippingCoverageType;
  active?: boolean;
  priority?: number;
  postalCodes?: string[];
  neighborhoods?: string[];
  polygon?: unknown;
  cost: string;
  freeShippingFrom?: string | null;
  maxWeightGrams?: number | null;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  deliveryWindows?: unknown;
}
