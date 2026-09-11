import type { FulfillmentOperationsRepository } from '../domain/fulfillment-operations.types';
import type { ShipmentRecord, ShipmentStatus } from '../domain/shipment.types';

export class ShipmentService {
  public constructor(private readonly repository: FulfillmentOperationsRepository) {}

  public getForCustomer(orderId: string, customerId: string): Promise<ShipmentRecord | null> {
    return this.repository.getShipmentForCustomer(orderId, customerId);
  }

  public getForAdmin(orderId: string): Promise<ShipmentRecord | null> {
    return this.repository.getShipmentForAdmin(orderId);
  }

  public async changeAddress(orderId: string, customerId: string, address: Record<string, string>) {
    const status = await this.repository.getOrderStatusForCustomer(orderId, customerId);
    if (!status) throw new Error('El pedido no existe o no pertenece a tu cuenta.');
    if (status !== 'PAID') throw new Error('La dirección solo puede cambiarse antes de iniciar la preparación.');
    await this.repository.changeOrderAddress(orderId, address);
  }

  public async transition(
    orderId: string,
    status: ShipmentStatus,
    actorUserId: string,
    input: { message?: string; carrier?: string; trackingNumber?: string; trackingUrl?: string },
  ) {
    return this.repository.transitionShipment({ orderId, status, actorUserId, ...input });
  }
}
