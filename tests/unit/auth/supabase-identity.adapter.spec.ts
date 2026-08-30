import { SupabaseIdentityAdapter } from '../../../src/infrastructure/identity/supabase/supabase-identity.adapter';
import { SupabaseAuthClient } from '../../../src/infrastructure/identity/supabase/supabase-auth.client';
import { SupabaseIdentityAdminClient } from '../../../src/infrastructure/identity/supabase/supabase-identity-admin.client';
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
    const adminClient = {
      client: { auth: { admin: {} } },
    } as unknown as SupabaseIdentityAdminClient;
    const adapter = new SupabaseIdentityAdapter(authClient, adminClient);

    await expect(adapter.verifyToken('expired-token')).rejects.toBeInstanceOf(
      ProviderAuthenticationError,
    );
  });

  it('generates a signup token without calling the public signup mail flow', async () => {
    const generateLink = jest.fn().mockResolvedValue({
      data: {
        user: {
          id: 'provider-user-id',
          email: 'persona@example.com',
          email_confirmed_at: null,
          user_metadata: { full_name: 'Persona' },
        },
        properties: { hashed_token: 'confirmation-token' },
      },
      error: null,
    });
    const authClient = {
      client: { auth: {} },
    } as unknown as SupabaseAuthClient;
    const adminClient = {
      client: { auth: { admin: { generateLink } } },
    } as unknown as SupabaseIdentityAdminClient;
    const adapter = new SupabaseIdentityAdapter(authClient, adminClient);

    await expect(
      adapter.register({
        email: 'persona@example.com',
        password: 'password-segura',
        displayName: 'Persona',
      }),
    ).resolves.toMatchObject({
      session: null,
      identity: {
        providerUserId: 'provider-user-id',
        displayName: 'Persona',
      },
      emailConfirmation: { token: 'confirmation-token', type: 'signup' },
    });
    expect(generateLink).toHaveBeenCalledWith({
      type: 'signup',
      email: 'persona@example.com',
      password: 'password-segura',
      options: { data: { full_name: 'Persona' } },
    });
  });
});
