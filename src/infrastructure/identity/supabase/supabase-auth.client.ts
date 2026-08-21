import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

const createSupabaseAuthClient = (url: string, publishableKey: string) =>
  createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

@Injectable()
export class SupabaseAuthClient {
  public readonly client: ReturnType<typeof createSupabaseAuthClient>;

  public constructor(configService: ConfigService) {
    this.client = createSupabaseAuthClient(
      configService.getOrThrow<string>('SUPABASE_URL'),
      configService.getOrThrow<string>('SUPABASE_PUBLISHABLE_KEY'),
    );
  }
}
