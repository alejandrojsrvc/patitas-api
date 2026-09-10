export type ShipmentStatus = 'PENDING' | 'PREPARING' | 'READY_FOR_DISPATCH' | 'SHIPPED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED' | 'RETURNED';

export interface ShipmentRecord {
  id: string;
  orderId: string;
  status: ShipmentStatus;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  estimatedDate: Date | null;
  estimatedSlot: string | null;
  createdAt: Date;
  updatedAt: Date;
  events: Array<{ id: string; status: ShipmentStatus; visibleMessage: string; occurredAt: Date }>;
}
