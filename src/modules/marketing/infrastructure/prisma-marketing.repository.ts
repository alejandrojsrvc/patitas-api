import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  MarketingEventPersistenceInput,
  MarketingEventRepository,
} from '../domain/marketing.repository';

@Injectable()
export class PrismaMarketingRepository implements MarketingEventRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async create(
    input: MarketingEventPersistenceInput,
  ): Promise<{ id: string; duplicate: boolean }> {
    try {
      const event = await this.prisma.marketingEvent.create({
        data: {
          eventName: input.eventName,
          eventId: input.eventId,
          source: input.source,
          visitorHash: input.visitorHash,
          value: input.value,
          currency: input.currency,
          payload: input.payload
            ? (input.payload as unknown as Prisma.InputJsonValue)
            : undefined,
          customerId: input.customerId,
          cartId: input.cartId,
          checkoutSessionId: input.checkoutSessionId,
          orderId: input.orderId,
          utmSource: input.utm?.source,
          utmMedium: input.utm?.medium,
          utmCampaign: input.utm?.campaign,
          utmContent: input.utm?.content,
          initialLanding: input.initialLanding,
        },
        select: { id: true },
      });
      return { id: event.id, duplicate: false };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const event = await this.prisma.marketingEvent.findFirst({
          where: { eventName: input.eventName, eventId: input.eventId },
          select: { id: true },
        });
        if (event) return { id: event.id, duplicate: true };
      }
      throw error;
    }
  }

  public async markSent(id: string): Promise<void> {
    await this.prisma.marketingEvent.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date() },
    });
  }

  public async markFailed(id: string, message: string): Promise<void> {
    await this.prisma.marketingEvent.update({
      where: { id },
      data: { status: 'FAILED', error: message },
    });
  }
}
