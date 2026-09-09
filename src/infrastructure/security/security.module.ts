import { Module } from '@nestjs/common';
import { BOT_CHALLENGE_PROVIDER } from '../../shared/application/ports/bot-challenge-provider.interface';
import { CloudflareTurnstileAdapter } from './cloudflare-turnstile.adapter';

@Module({
  providers: [CloudflareTurnstileAdapter, { provide: BOT_CHALLENGE_PROVIDER, useExisting: CloudflareTurnstileAdapter }],
  exports: [BOT_CHALLENGE_PROVIDER],
})
export class SecurityModule {}
