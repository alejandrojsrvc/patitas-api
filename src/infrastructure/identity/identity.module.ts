import { Module } from '@nestjs/common';
import { IDENTITY_PROVIDER } from '../../shared/application/ports/identity-provider.interface';
import { SupabaseAuthClient } from './supabase/supabase-auth.client';
import { SupabaseIdentityAdapter } from './supabase/supabase-identity.adapter';

@Module({
  providers: [
    SupabaseAuthClient,
    SupabaseIdentityAdapter,
    {
      provide: IDENTITY_PROVIDER,
      useExisting: SupabaseIdentityAdapter,
    },
  ],
  exports: [IDENTITY_PROVIDER],
})
export class IdentityModule {}
