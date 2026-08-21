import { Module } from '@nestjs/common';
import { STORAGE_PROVIDER } from '../../shared/application/ports/storage-provider.interface';
import { SupabaseAdminClient } from './supabase/supabase-admin.client';
import { SupabaseStorageAdapter } from './supabase/supabase-storage.adapter';

@Module({
  providers: [
    SupabaseAdminClient,
    SupabaseStorageAdapter,
    {
      provide: STORAGE_PROVIDER,
      useExisting: SupabaseStorageAdapter,
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
