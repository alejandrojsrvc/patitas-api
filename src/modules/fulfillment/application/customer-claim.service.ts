import type { FulfillmentOperationsRepository } from '../domain/fulfillment-operations.types';

export class CustomerClaimService {
  public constructor(private readonly repository: FulfillmentOperationsRepository) {}

  public async create(orderId: string, customerId: string, type: string, message: string) {
    if (!(await this.repository.orderBelongsToCustomer(orderId, customerId))) throw new Error('El pedido no existe o no pertenece a tu cuenta.');
    return this.repository.createClaim({ orderId, customerId, type, message: message.trim() });
  }

  public listForCustomer(orderId: string, customerId: string) {
    return this.repository.listClaims(orderId, customerId);
  }

  public async update(id: string, status: string, resolution?: string) {
    return this.repository.updateClaim(id, status, resolution?.trim() || null);
  }
}
