import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

const createSupabaseAdminClient = (url: string, secretKey: string) =>
  createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

@Injectable()
export class SupabaseAdminClient {
  public readonly client: ReturnType<typeof createSupabaseAdminClient>;

  public constructor(configService: ConfigService) {
    this.client = createSupabaseAdminClient(
      configService.getOrThrow<string>('SUPABASE_URL'),
      configService.getOrThrow<string>('SUPABASE_SECRET_KEY'),
    );
  }
}
