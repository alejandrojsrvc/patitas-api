import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BotChallengeInput, BotChallengeProvider } from '../../shared/application/ports/bot-challenge-provider.interface';

@Injectable()
export class CloudflareTurnstileAdapter implements BotChallengeProvider {
  private readonly secret: string | undefined;
  private readonly expectedHostnames: ReadonlySet<string>;
  private readonly production: boolean;

  public constructor(config: ConfigService) {
    this.secret = config.get<string>('CLOUDFLARE_TURNSTILE_SECRET_KEY')?.trim() || undefined;
    this.expectedHostnames = new Set(
      (config.get<string>('CLOUDFLARE_TURNSTILE_HOSTNAMES') ?? '')
        .split(',')
        .map((hostname) => hostname.trim().toLowerCase())
        .filter(Boolean),
    );
    this.production = config.getOrThrow<string>('NODE_ENV') === 'production';
  }

  public async verify(input: BotChallengeInput): Promise<boolean> {
    if (!this.secret) return !this.production;
    if (this.expectedHostnames.size === 0 || input.token.length === 0 || input.token.length > 2_048) return false;
    const body = new URLSearchParams({ secret: this.secret, response: input.token });
    if (input.remoteIp) body.set('remoteip', input.remoteIp);

    try {
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return false;
      const result = (await response.json()) as { success?: boolean; action?: string; hostname?: string };
      return (
        result.success === true &&
        result.action === input.expectedAction &&
        typeof result.hostname === 'string' &&
        this.expectedHostnames.has(result.hostname.trim().toLowerCase())
      );
    } catch {
      return false;
    }
  }
}
