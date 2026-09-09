import type { ConfigService } from '@nestjs/config';
import { CloudflareTurnstileAdapter } from '../../../src/infrastructure/security/cloudflare-turnstile.adapter';

describe('CloudflareTurnstileAdapter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('accepts only a successful response with the expected action and hostname', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, action: 'auth-login', hostname: 'patitasinquietas.com.ar' }),
    } as Response);
    const adapter = createAdapter();

    await expect(
      adapter.verify({
        token: 'fresh-token',
        expectedAction: 'auth-login',
        remoteIp: '203.0.113.10',
      }),
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    const body = fetchMock.mock.calls[0]?.[1]?.body;
    expect(body).toBeInstanceOf(URLSearchParams);
    if (!(body instanceof URLSearchParams)) throw new Error('Expected a URLSearchParams body.');
    expect(body.get('response')).toBe('fresh-token');
    expect(body.get('remoteip')).toBe('203.0.113.10');
  });

  it('rejects a valid token from an unapproved hostname', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, action: 'auth-login', hostname: 'attacker.example' }),
    } as Response);
    const adapter = createAdapter();

    await expect(adapter.verify({ token: 'fresh-token', expectedAction: 'auth-login' })).resolves.toBe(false);
  });

  it('fails closed when a secret is configured without hostnames', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const adapter = createAdapter({ CLOUDFLARE_TURNSTILE_HOSTNAMES: '' });

    await expect(adapter.verify({ token: 'fresh-token', expectedAction: 'auth-login' })).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function createAdapter(overrides: Record<string, string> = {}): CloudflareTurnstileAdapter {
  const values = {
    CLOUDFLARE_TURNSTILE_SECRET_KEY: 'test-secret',
    CLOUDFLARE_TURNSTILE_HOSTNAMES: 'patitasinquietas.com.ar,localhost,127.0.0.1',
    NODE_ENV: 'test',
    ...overrides,
  };
  const config = {
    get: (key: string) => values[key as keyof typeof values],
    getOrThrow: (key: string) => values[key as keyof typeof values],
  } as unknown as ConfigService;
  return new CloudflareTurnstileAdapter(config);
}
