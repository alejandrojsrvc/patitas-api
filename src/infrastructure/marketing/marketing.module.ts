import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MARKETING_PROVIDER, type MarketingProvider } from '../../shared/application/ports/marketing-provider.interface';
import { HttpMarketingAdapter } from './http-marketing.adapter';
import { NoopMarketingAdapter } from './noop-marketing.adapter';

@Module({ imports: [ConfigModule], providers: [HttpMarketingAdapter, NoopMarketingAdapter, { provide: MARKETING_PROVIDER, inject: [ConfigService, HttpMarketingAdapter, NoopMarketingAdapter], useFactory: (config: ConfigService, http: HttpMarketingAdapter, noop: NoopMarketingAdapter): MarketingProvider => config.get<string>('MARKETING_PROVIDER', 'noop') === 'http' ? http : noop }], exports: [MARKETING_PROVIDER] })
export class MarketingInfrastructureModule {}
