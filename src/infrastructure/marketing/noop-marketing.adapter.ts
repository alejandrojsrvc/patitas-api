import { Injectable } from '@nestjs/common';
import type { MarketingEventInput, MarketingProvider } from '../../shared/application/ports/marketing-provider.interface';
@Injectable()
export class NoopMarketingAdapter implements MarketingProvider { public async send(_input: MarketingEventInput) {} }
