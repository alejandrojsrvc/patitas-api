import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Injectable } from '@nestjs/common';
import type { GuestActivationRecord, GuestOrderActivationRepository } from '../domain/guest-order-activation.repository';

@Injectable()
export class PrismaGuestOrderActivationRepository implements GuestOrderActivationRepository {
  public constructor(private readonly prisma: PrismaService) {}
  public async findActive(tokenHash: string): Promise<GuestActivationRecord | null> {
    return this.prisma.guestOrderActivationToken.findFirst({
      where: { tokenHash, consumedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, orderId: true, email: true },
    });
  }
  public async consumeAndLink(input: { tokenHash: string; userId: string; orderId: string; email: string }): Promise<string> {
    return this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.guestOrderActivationToken.updateMany({
        where: { tokenHash: input.tokenHash, consumedAt: null, expiresAt: { gt: new Date() }, orderId: input.orderId },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) throw new Error('El enlace de activación ya no está disponible.');
      const customer = await transaction.customer.findFirst({ where: { userId: input.userId } });
      if (!customer) throw new Error('No se pudo crear el perfil de cliente.');
      await transaction.order.updateMany({
        where: { id: input.orderId, customerId: null, contactEmail: input.email },
        data: { customerId: customer.id },
      });
      await transaction.order.updateMany({ where: { customerId: null, contactEmail: input.email }, data: { customerId: customer.id } });
      return customer.id;
    });
  }
}
