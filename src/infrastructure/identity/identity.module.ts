import { Module } from '@nestjs/common';
import { IDENTITY_PROVIDER } from '../../shared/application/ports/identity-provider.interface';
import { SupabaseAuthClient } from './supabase/supabase-auth.client';
import { SupabaseIdentityAdapter } from './supabase/supabase-identity.adapter';
import { SupabaseIdentityAdminClient } from './supabase/supabase-identity-admin.client';

@Module({
  providers: [
    SupabaseAuthClient,
    SupabaseIdentityAdminClient,
    SupabaseIdentityAdapter,
    {
      provide: IDENTITY_PROVIDER,
      useExisting: SupabaseIdentityAdapter,
    },
  ],
  exports: [IDENTITY_PROVIDER],
})
export class IdentityModule {}
