import type { MarketingEventInput } from '../../domain/marketing-event.types';

export const MARKETING_PROVIDER = Symbol('MARKETING_PROVIDER');
export type { MarketingEventInput } from '../../domain/marketing-event.types';
export interface MarketingProvider {
  send(input: MarketingEventInput): Promise<void>;
}
