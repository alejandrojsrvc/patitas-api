export const MARKETING_PROVIDER = Symbol('MARKETING_PROVIDER');
export interface MarketingEventInput { eventName: 'Quiz_Completed' | 'InitiateCheckout' | 'Purchase'; eventId: string; value?: string; currency?: string; payload?: Record<string, unknown>; }
export interface MarketingProvider { send(input: MarketingEventInput): Promise<void>; }
