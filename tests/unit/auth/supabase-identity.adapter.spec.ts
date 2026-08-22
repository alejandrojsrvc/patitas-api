import { SupabaseIdentityAdapter } from '../../../src/infrastructure/identity/supabase/supabase-identity.adapter';
import { SupabaseAuthClient } from '../../../src/infrastructure/identity/supabase/supabase-auth.client';
import { ProviderAuthenticationError } from '../../../src/shared/application/provider-error';

describe('SupabaseIdentityAdapter', () => {
  it('classifies an expired bad_jwt as an authentication failure', async () => {
    const getUser = jest.fn().mockResolvedValue({
      data: { user: null },
      error: { status: 403, code: 'bad_jwt' },
    });
    const authClient = {
      client: { auth: { getUser } },
    } as unknown as SupabaseAuthClient;
    const adapter = new SupabaseIdentityAdapter(authClient);

    await expect(adapter.verifyToken('expired-token')).rejects.toBeInstanceOf(
      ProviderAuthenticationError,
    );
  });
});
