import type { MarketingEventInput } from '../../../shared/domain/marketing-event.types';

export const MARKETING_REPOSITORY = Symbol('MARKETING_REPOSITORY');

export interface MarketingEventPersistenceInput extends MarketingEventInput {
  source: string;
  visitorHash?: string;
  customerId?: string;
  cartId?: string;
  checkoutSessionId?: string;
  orderId?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
  };
  initialLanding?: string;
}

export interface MarketingEventRepository {
  create(input: MarketingEventPersistenceInput): Promise<{
    id: string;
    duplicate: boolean;
  }>;
  markSent(id: string): Promise<void>;
  markFailed(id: string, message: string): Promise<void>;
}
