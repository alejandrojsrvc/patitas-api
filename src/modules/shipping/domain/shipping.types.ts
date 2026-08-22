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

export interface ShippingQuote {
  available: boolean;
  zoneId: string | null;
  zoneName: string | null;
  cost: string;
  estimate: string | null;
  message: string;
}
