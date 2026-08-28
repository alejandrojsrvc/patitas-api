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
      const handoff = await tx.checkoutHandoff.findFirst({
        where: { tokenHash, consumedAt: null, expiresAt: { gt: new Date() } },
      });
      if (!handoff)
        throw new CheckoutHandoffError(
          'El enlace de checkout no existe o expiró.',
        );
      const cartToken = createAnonymousToken();
      await tx.checkoutHandoff.update({
        where: { id: handoff.id },
        data: { consumedAt: new Date() },
      });
      await tx.cart.update({
        where: { id: handoff.cartId },
        data: { anonymousTokenHash: hashAnonymousToken(cartToken) },
      });
      return { cartId: handoff.cartId, cartToken };
    });
    return result;
  }
}
