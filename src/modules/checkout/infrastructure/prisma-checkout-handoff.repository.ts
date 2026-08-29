import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  createAnonymousToken,
  hashAnonymousToken,
} from '../../../shared/application/anonymous-token';
import { DomainError } from '../../../shared/domain/domain-error';
import type { CheckoutHandoffRepository } from '../domain/checkout-handoff.repository';

export class CheckoutHandoffError extends DomainError {
  public constructor(message: string) {
    super(message, 'CHECKOUT_HANDOFF_INVALID');
  }
}

@Injectable()
export class PrismaCheckoutHandoffRepository implements CheckoutHandoffRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async create(cartId: string, tokenHash: string, token: string) {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.prisma.checkoutHandoff.create({
      data: { cartId, tokenHash, expiresAt },
    });
    return { token, expiresAt };
  }

  public async consume(tokenHash: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.checkoutHandoff.updateMany({
        where: { tokenHash, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      });
      if (claimed.count !== 1)
        throw new CheckoutHandoffError(
          'El enlace de checkout no existe o expiró.',
        );
      const handoff = await tx.checkoutHandoff.findUniqueOrThrow({
        where: { tokenHash },
      });
      const cartToken = createAnonymousToken();
      await tx.cart.update({
        where: { id: handoff.cartId },
        data: { anonymousTokenHash: hashAnonymousToken(cartToken) },
      });
      return { cartId: handoff.cartId, cartToken };
    });
    return result;
  }
}
