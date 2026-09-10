import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import type { FulfillmentOperationsRepository, CustomerClaimRecord } from '../../domain/fulfillment-operations.types';
import type { ShipmentRecord, ShipmentStatus } from '../../domain/shipment.types';

const transitions: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDING: ['PREPARING', 'FAILED'],
  PREPARING: ['READY_FOR_DISPATCH', 'FAILED'],
  READY_FOR_DISPATCH: ['SHIPPED', 'FAILED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'RETURNED', 'FAILED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED', 'RETURNED'],
  DELIVERED: [],
  FAILED: ['PREPARING', 'RETURNED'],
  RETURNED: [],
};

const messages: Record<ShipmentStatus, string> = {
  PENDING: 'Recibimos tu pedido.',
  PREPARING: 'Estamos preparando tu pedido.',
  READY_FOR_DISPATCH: 'Tu pedido está listo para despacho.',
  SHIPPED: 'Tu pedido fue despachado.',
  OUT_FOR_DELIVERY: 'Tu pedido está en camino.',
  DELIVERED: 'Tu pedido fue entregado.',
  FAILED: 'Tuvimos un inconveniente con la entrega.',
  RETURNED: 'El pedido fue devuelto.',
};

@Injectable()
export class PrismaFulfillmentOperationsRepository implements FulfillmentOperationsRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async orderBelongsToCustomer(orderId: string, customerId: string): Promise<boolean> {
    return Boolean(await this.prisma.order.findFirst({ where: { id: orderId, customerId }, select: { id: true } }));
  }

  public async createClaim(input: { orderId: string; customerId: string; type: string; message: string }): Promise<CustomerClaimRecord> {
    return this.prisma.customerClaim.create({
      data: { id: randomUUID(), ...input, type: input.type as never },
    });
  }

  public listClaims(orderId: string, customerId: string): Promise<CustomerClaimRecord[]> {
    return this.prisma.customerClaim.findMany({ where: { orderId, customerId }, orderBy: { createdAt: 'desc' } });
  }

  public updateClaim(id: string, status: string, resolution: string | null): Promise<CustomerClaimRecord> {
    return this.prisma.customerClaim.update({ where: { id }, data: { status: status as never, resolution } });
  }

  public async getShipmentForCustomer(orderId: string, customerId: string): Promise<ShipmentRecord | null> {
    const shipment = await this.prisma.shipment.findFirst({
      where: { orderId, order: { customerId } },
      include: { events: { orderBy: { occurredAt: 'asc' } } },
    });
    return shipment ? mapShipment(shipment) : null;
  }

  public async getShipmentForAdmin(orderId: string): Promise<ShipmentRecord | null> {
    const shipment = await this.prisma.shipment.findUnique({ where: { orderId }, include: { events: { orderBy: { occurredAt: 'asc' } } } });
    return shipment ? mapShipment(shipment) : null;
  }

  public async getOrderStatusForCustomer(orderId: string, customerId: string): Promise<string | null> {
    return (await this.prisma.order.findFirst({ where: { id: orderId, customerId }, select: { status: true } }))?.status ?? null;
  }

  public async changeOrderAddress(orderId: string, address: Record<string, string>): Promise<void> {
    await this.prisma.order.update({ where: { id: orderId }, data: { shippingAddress: address } });
  }

  public async transitionShipment(input: {
    orderId: string;
    status: ShipmentStatus;
    actorUserId: string;
    message?: string;
    carrier?: string;
    trackingNumber?: string;
    trackingUrl?: string;
  }): Promise<ShipmentRecord> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.shipment.findUnique({ where: { orderId: input.orderId } });
      if (!current) {
        if (input.status !== 'PENDING') throw new Error('El envío todavía no fue creado.');
        const created = await transaction.shipment.create({
          data: {
            id: randomUUID(),
            orderId: input.orderId,
            status: 'PENDING',
            events: {
              create: {
                id: randomUUID(),
                status: 'PENDING',
                visibleMessage: input.message?.trim() || messages.PENDING,
                actorUserId: input.actorUserId,
              },
            },
          },
          include: { events: true },
        });
        return mapShipment(created);
      }
      if (current.status !== input.status && !transitions[current.status as ShipmentStatus].includes(input.status))
        throw new Error(`No se puede pasar el envío de ${current.status} a ${input.status}.`);
      await transaction.shipment.update({
        where: { id: current.id },
        data: {
          status: input.status,
          carrier: input.carrier?.trim() || undefined,
          trackingNumber: input.trackingNumber?.trim() || undefined,
          trackingUrl: input.trackingUrl?.trim() || undefined,
        },
      });
      try {
        await transaction.shipmentEvent.create({
          data: {
            id: randomUUID(),
            shipmentId: current.id,
            status: input.status,
            visibleMessage: input.message?.trim() || messages[input.status],
            actorUserId: input.actorUserId,
          },
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
      }
      return mapShipment(
        await transaction.shipment.findUniqueOrThrow({ where: { id: current.id }, include: { events: { orderBy: { occurredAt: 'asc' } } } }),
      );
    });
  }
}

const mapShipment = (value: {
  id: string;
  orderId: string;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  estimatedDate: Date | null;
  estimatedSlot: string | null;
  createdAt: Date;
  updatedAt: Date;
  events: Array<{ id: string; status: string; visibleMessage: string; occurredAt: Date }>;
}): ShipmentRecord => ({
  id: value.id,
  orderId: value.orderId,
  status: value.status as ShipmentStatus,
  carrier: value.carrier,
  trackingNumber: value.trackingNumber,
  trackingUrl: value.trackingUrl,
  estimatedDate: value.estimatedDate,
  estimatedSlot: value.estimatedSlot,
  createdAt: value.createdAt,
  updatedAt: value.updatedAt,
  events: value.events.map((event) => ({
    id: event.id,
    status: event.status as ShipmentStatus,
    visibleMessage: event.visibleMessage,
    occurredAt: event.occurredAt,
  })),
});
