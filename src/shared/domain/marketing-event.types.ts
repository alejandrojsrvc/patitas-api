export interface MarketingEventInput {
  eventName: 'Quiz_Completed' | 'InitiateCheckout' | 'Purchase';
  eventId: string;
  value?: string;
  currency?: string;
  payload?: Record<string, unknown>;
}
