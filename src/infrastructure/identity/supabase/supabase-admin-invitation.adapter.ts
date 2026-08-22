import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { IdentityAdminProvider } from '../../../shared/application/ports/identity-admin-provider.interface';
import type { ProviderIdentity } from '../../../shared/application/ports/identity-provider.interface';

type AdminDatabase = {
  public: {
    Tables: Record<
      string,
      {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      }
    >;
    Views: Record<
      string,
      {
        Row: Record<string, unknown>;
        Relationships: [];
      }
    >;
    Functions: Record<
      string,
      {
        Args: Record<string, unknown>;
        Returns: unknown;
      }
    >;
  };
};

export class SupabaseAdminInvitationAdapter implements IdentityAdminProvider {
  private readonly client: SupabaseClient<AdminDatabase>;

  public constructor(supabaseUrl: string, secretKey: string) {
    this.client = createClient<AdminDatabase>(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }

  public async inviteUser(
    email: string,
    redirectTo: string,
  ): Promise<ProviderIdentity> {
    const { data, error } = await this.client.auth.admin.inviteUserByEmail(
      email,
      { redirectTo },
    );
    if (error || !data.user?.id || !data.user.email) {
      throw new Error(
        error?.message ?? 'Supabase no pudo crear la invitación.',
      );
    }

    return {
      provider: 'supabase',
      providerUserId: data.user.id,
      email: data.user.email,
      emailVerified: Boolean(data.user.email_confirmed_at),
    };
  }
}
