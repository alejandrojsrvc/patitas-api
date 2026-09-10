import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { BotChallengeInput } from '../application/ports/bot-challenge-provider.interface';

type RateLimitPolicy = {
  id: string;
  limit: number;
  windowMs: number;
  scope: 'client' | 'instance';
  matches: (request: Request) => boolean;
};

type Bucket = { count: number; resetAt: number };

const MAX_URL_LENGTH = 2_048;
const MAX_BUCKETS = 20_000;
const buckets = new Map<string, Bucket>();
let nextSweepAt = 0;

const policies: RateLimitPolicy[] = [
  {
    id: 'all-client',
    limit: 600,
    windowMs: 60_000,
    scope: 'client',
    matches: () => true,
  },
  {
    id: 'auth-client',
    limit: 12,
    windowMs: 60_000,
    scope: 'client',
    matches: ({ method, path }) =>
      method === 'POST' && /^\/api\/v1\/(?:mobile\/)?auth\/(?:register|login|password-recovery|email-confirmation\/resend)$/.test(path),
  },
  {
    id: 'auth-token-client',
    limit: 60,
    windowMs: 60_000,
    scope: 'client',
    matches: ({ method, path }) =>
      method === 'POST' &&
      /^\/api\/v1\/(?:mobile\/)?auth\/(?:refresh|logout|logout-all|password-reset|invitation\/accept|email-confirmation\/confirm)$/.test(path),
  },
  {
    id: 'catalog-client',
    limit: 120,
    windowMs: 60_000,
    scope: 'client',
    matches: ({ method, path }) =>
      method === 'GET' &&
      /^\/api\/v1\/(?:products|categories|brands|offers|catalog\/taxonomy|mobile\/(?:products|categories|offers|pet-breeds))(?:\/|$)/.test(path),
  },
  {
    id: 'catalog-search-client',
    limit: 30,
    windowMs: 60_000,
    scope: 'client',
    matches: ({ method, path, query }) => method === 'GET' && path === '/api/v1/products' && hasNonEmptyQuery(query.q),
  },
  {
    id: 'catalog-search-facets-client',
    limit: 30,
    windowMs: 60_000,
    scope: 'client',
    matches: ({ method, path, query }) => method === 'GET' && path === '/api/v1/products/facets' && hasNonEmptyQuery(query.q),
  },
  {
    id: 'catalog-autocomplete-client',
    limit: 60,
    windowMs: 60_000,
    scope: 'client',
    matches: ({ method, path }) => method === 'GET' && path === '/api/v1/products/autocomplete',
  },
  {
    id: 'catalog-instance',
    limit: 300,
    windowMs: 60_000,
    scope: 'instance',
    matches: ({ method, path }) =>
      method === 'GET' &&
      /^\/api\/v1\/(?:products|categories|brands|offers|catalog\/taxonomy|mobile\/(?:products|categories|offers|pet-breeds))(?:\/|$)/.test(path),
  },
  {
    id: 'anonymous-write-client',
    limit: 30,
    windowMs: 60_000,
    scope: 'client',
    matches: ({ method, path }) =>
      (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && /^\/api\/v1\/cart(?:\/|$)/.test(path)) ||
      (method !== 'GET' &&
        /^\/api\/v1\/(?:checkout\/sessions|replenishment-(?:estimates|reminders)|marketing\/events|products\/[^/]+\/view|calculator\/food-duration)(?:\/|$)/.test(
          path,
        )),
  },
  {
    id: 'anonymous-write-instance',
    limit: 120,
    windowMs: 60_000,
    scope: 'instance',
    matches: ({ method, path }) =>
      (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && /^\/api\/v1\/cart(?:\/|$)/.test(path)) ||
      (method !== 'GET' &&
        /^\/api\/v1\/(?:checkout\/sessions|replenishment-(?:estimates|reminders)|marketing\/events|products\/[^/]+\/view|calculator\/food-duration)(?:\/|$)/.test(
          path,
        )),
  },
  {
    id: 'payment-client',
    limit: 12,
    windowMs: 60_000,
    scope: 'client',
    matches: ({ method, path }) => method === 'POST' && /^\/api\/v1\/(?:mobile\/)?payments\/orders\//.test(path),
  },
  {
    id: 'webhook-instance',
    limit: 300,
    windowMs: 60_000,
    scope: 'instance',
    matches: ({ method, path }) => method === 'POST' && /^\/api\/v1\/payments\/webhooks\//.test(path),
  },
  {
    id: 'handoff-client',
    limit: 10,
    windowMs: 60_000,
    scope: 'client',
    matches: ({ method, path }) => method === 'POST' && /^\/api\/v1\/checkout\/handoffs\/[^/]+\/consume$/.test(path),
  },
  {
    id: 'shipping-client',
    limit: 60,
    windowMs: 60_000,
    scope: 'client',
    matches: ({ method, path }) => method === 'GET' && path === '/api/v1/shipping/quote',
  },
];

export function createHttpSecurityMiddleware(input: {
  production: boolean;
  vercelProduction: boolean;
  originVerifySecret?: string;
  botChallengeEnabled: boolean;
  verifyBotChallenge: (input: BotChallengeInput) => Promise<boolean>;
}) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    setSecurityHeaders(response, input.production);
    setSensitiveCacheHeaders(request, response);

    if (request.originalUrl.length > MAX_URL_LENGTH) {
      response.status(414).json({ code: 'URI_TOO_LONG', message: 'La URL solicitada es demasiado larga.' });
      return;
    }

    if (hasOversizedSecurityHeader(request)) {
      response.status(400).json({ code: 'INVALID_HEADER', message: 'Una cabecera de la solicitud es demasiado larga.' });
      return;
    }

    if (hasOversizedJsonBody(request)) {
      response.status(413).json({ code: 'PAYLOAD_TOO_LARGE', message: 'El cuerpo de la solicitud es demasiado grande.' });
      return;
    }

    if (input.vercelProduction && directVercelHostname(request)) {
      response.status(404).json({ code: 'ORIGIN_NOT_AVAILABLE', message: 'Recurso no disponible.' });
      return;
    }

    if (input.production && !validOriginSecret(request, input.originVerifySecret)) {
      response.status(404).json({ code: 'ORIGIN_NOT_AVAILABLE', message: 'Recurso no disponible.' });
      return;
    }

    if (request.method === 'OPTIONS') {
      next();
      return;
    }

    const now = Date.now();
    sweepExpiredBuckets(now);
    const clientId = requestClientId(request, input.production);
    for (const policy of policies) {
      if (!policy.matches(request)) continue;
      const key = `${policy.id}:${policy.scope === 'instance' ? 'instance' : clientId}`;
      const result = consume(key, policy, now);
      if (!result.allowed) {
        response.setHeader('Retry-After', String(Math.max(1, Math.ceil((result.resetAt - now) / 1_000))));
        response.setHeader('Cache-Control', 'private, no-store');
        response.status(429).json({ code: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Intentá nuevamente en unos segundos.' });
        return;
      }
    }

    const challengeAction = requiredChallengeAction(request);
    if (challengeAction && input.botChallengeEnabled) {
      const challengeHeader = request.headers['x-turnstile-token'];
      const token = Array.isArray(challengeHeader) ? challengeHeader[0] : challengeHeader;
      const valid = Boolean(
        token &&
        token.length <= 2_048 &&
        (await input.verifyBotChallenge({ token, expectedAction: challengeAction, remoteIp: clientId === 'unknown' ? undefined : clientId })),
      );
      if (!valid) {
        response.status(403).json({ code: 'BOT_CHALLENGE_FAILED', message: 'No fue posible validar la solicitud.' });
        return;
      }
    }

    next();
  };
}

function consume(key: string, policy: RateLimitPolicy, now: number): { allowed: boolean; resetAt: number } {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    ensureBucketCapacity(now);
    const resetAt = now + policy.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, resetAt };
  }
  current.count += 1;
  return { allowed: current.count <= policy.limit, resetAt: current.resetAt };
}

function ensureBucketCapacity(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  sweepExpiredBuckets(now, true);
  if (buckets.size < MAX_BUCKETS) return;
  const oldestKey = buckets.keys().next().value as string | undefined;
  if (oldestKey) buckets.delete(oldestKey);
}

function sweepExpiredBuckets(now: number, force = false): void {
  if (!force && now < nextSweepAt) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  nextSweepAt = now + 60_000;
}

function requestClientId(request: Request, trustedCloudflare: boolean): string {
  const candidates = trustedCloudflare ? [request.headers['cf-connecting-ip']] : [];
  for (const candidate of candidates) {
    const value = Array.isArray(candidate) ? candidate[0] : candidate;
    const address = value?.split(',')[0]?.trim();
    if (address && address.length <= 64 && /^[a-f0-9:.]+$/i.test(address)) return address;
  }
  return request.socket.remoteAddress?.slice(0, 64) || 'unknown';
}

function directVercelHostname(request: Request): boolean {
  return hostnameFromRequest(request).endsWith('.vercel.app');
}

function hasOversizedSecurityHeader(request: Request): boolean {
  const limits: Record<string, number> = {
    authorization: 8_192,
    'idempotency-key': 200,
    'x-cart-token': 2_048,
    'x-checkout-token': 2_048,
    'x-order-token': 2_048,
    'x-replenishment-token': 2_048,
    'x-visitor-id': 160,
    'user-agent': 1_024,
    'x-request-id': 160,
    'x-turnstile-token': 2_048,
  };
  return Object.entries(limits).some(([name, limit]) => {
    const value = request.headers[name];
    return (Array.isArray(value) ? value.join(',') : (value ?? '')).length > limit;
  });
}

function requiredChallengeAction(request: Request): string | null {
  if (request.method !== 'POST') return null;
  const authMatch = request.path.match(/^\/api\/v1\/(?:mobile\/)?auth\/(register|login|password-recovery|email-confirmation\/resend)$/);
  if (authMatch) return `auth-${authMatch[1].replaceAll('/', '-')}`;
  if (!request.headers.authorization && /^\/api\/v1\/checkout\/sessions\/[^/]+\/confirm$/.test(request.path)) {
    return 'anonymous-checkout';
  }
  return null;
}

function hasNonEmptyQuery(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function validOriginSecret(request: Request, configuredSecret?: string): boolean {
  const received = request.headers['x-origin-verify'];
  const value = Array.isArray(received) ? received[0] : received;
  if (!configuredSecret || !value) return false;
  const expectedBuffer = Buffer.from(configuredSecret);
  const receivedBuffer = Buffer.from(value);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function hasOversizedJsonBody(request: Request): boolean {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) return false;
  const contentLength = Number(request.headers['content-length']);
  return Number.isFinite(contentLength) && contentLength > 128 * 1_024;
}

function hostnameFromRequest(request: Request): string {
  const raw = request.headers.host?.trim().toLowerCase() ?? '';
  if (raw.startsWith('[')) return raw.slice(1, raw.indexOf(']'));
  return raw.split(':')[0];
}

function setSecurityHeaders(response: Response, production: boolean): void {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (!production) return;
  response.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
}

function setSensitiveCacheHeaders(request: Request, response: Response): void {
  const hasCredentials = Boolean(
    request.headers.authorization ||
    request.headers['x-cart-token'] ||
    request.headers['x-checkout-token'] ||
    request.headers['x-order-token'] ||
    request.headers['x-replenishment-token'],
  );
  const sensitivePath = /^\/api\/v1\/(?:auth|me|cart|checkout|communications|replenishment-|payments\/orders|storefront|mobile\/me)(?:\/|$)/.test(
    request.path,
  );
  if (!hasCredentials && !sensitivePath) return;
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Pragma', 'no-cache');
}
