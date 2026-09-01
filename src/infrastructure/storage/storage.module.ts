import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STORAGE_PROVIDER } from '../../shared/application/ports/storage-provider.interface';
import { CloudflareR2StorageAdapter } from './cloudflare/cloudflare-r2-storage.adapter';
import { SupabaseAdminClient } from './supabase/supabase-admin.client';
import { SupabaseStorageAdapter } from './supabase/supabase-storage.adapter';

@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const provider = configService.getOrThrow<'supabase' | 'r2'>(
          'STORAGE_PROVIDER',
        );

        if (provider === 'r2') {
          return new CloudflareR2StorageAdapter(configService);
        }

        return new SupabaseStorageAdapter(
          new SupabaseAdminClient(configService),
        );
      },
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
