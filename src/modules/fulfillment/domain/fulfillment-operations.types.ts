import type { ShipmentRecord, ShipmentStatus } from './shipment.types';

export const FULFILLMENT_OPERATIONS_REPOSITORY = Symbol('FULFILLMENT_OPERATIONS_REPOSITORY');

export interface CustomerClaimRecord {
  id: string;
  orderId: string;
  customerId: string;
  type: string;
  status: string;
  message: string;
  resolution: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FulfillmentOperationsRepository {
  orderBelongsToCustomer(orderId: string, customerId: string): Promise<boolean>;
  createClaim(input: { orderId: string; customerId: string; type: string; message: string }): Promise<CustomerClaimRecord>;
  listClaims(orderId: string, customerId: string): Promise<CustomerClaimRecord[]>;
  updateClaim(id: string, status: string, resolution: string | null): Promise<CustomerClaimRecord>;
  getShipmentForCustomer(orderId: string, customerId: string): Promise<ShipmentRecord | null>;
  getShipmentForAdmin(orderId: string): Promise<ShipmentRecord | null>;
  getOrderStatusForCustomer(orderId: string, customerId: string): Promise<string | null>;
  changeOrderAddress(orderId: string, address: Record<string, string>): Promise<void>;
  transitionShipment(input: {
    orderId: string;
    status: ShipmentStatus;
    actorUserId: string;
    message?: string;
    carrier?: string;
    trackingNumber?: string;
    trackingUrl?: string;
  }): Promise<ShipmentRecord>;
}
