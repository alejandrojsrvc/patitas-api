import { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import type { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { MarketingEventInput, MarketingProvider } from '../../../shared/application/ports/marketing-provider.interface';

export class MarketingService {
  public constructor(private readonly prisma: PrismaService, private readonly provider: MarketingProvider) {}
  public async record(input: MarketingEventInput & { source: string; visitorHash?: string; customerId?: string; cartId?: string; checkoutSessionId?: string; orderId?: string; utm?: { source?: string; medium?: string; campaign?: string; content?: string }; initialLanding?: string }) {
    const db = this.prisma as any;
    let event: any;
    try {
      event = await db.marketingEvent.create({ data: { eventName: input.eventName, eventId: input.eventId, source: input.source, visitorHash: input.visitorHash, value: input.value, currency: input.currency, payload: input.payload as Prisma.InputJsonValue | undefined, customerId: input.customerId, cartId: input.cartId, checkoutSessionId: input.checkoutSessionId, orderId: input.orderId, utmSource: input.utm?.source, utmMedium: input.utm?.medium, utmCampaign: input.utm?.campaign, utmContent: input.utm?.content, initialLanding: input.initialLanding } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { accepted: true, duplicate: true };
      throw error;
    }
    try { await this.provider.send(input); await db.marketingEvent.update({ where: { id: event.id }, data: { status: 'SENT', sentAt: new Date() } }); return { accepted: true, duplicate: false }; }
    catch (error) { await db.marketingEvent.update({ where: { id: event.id }, data: { status: 'FAILED', error: error instanceof Error ? error.message : 'Proveedor no disponible' } }); return { accepted: false, duplicate: false }; }
  }
}
