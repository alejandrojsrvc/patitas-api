import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

const createSupabaseIdentityAdminClient = (url: string, secretKey: string) =>
  createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

@Injectable()
export class SupabaseIdentityAdminClient {
  public readonly client: ReturnType<typeof createSupabaseIdentityAdminClient>;

  public constructor(configService: ConfigService) {
    this.client = createSupabaseIdentityAdminClient(
      configService.getOrThrow<string>('SUPABASE_URL'),
      configService.getOrThrow<string>('SUPABASE_SECRET_KEY'),
    );
  }
}
