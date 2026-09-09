import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3StorageAdapter } from '../s3/s3-storage.adapter';

@Injectable()
export class CloudflareR2StorageAdapter extends S3StorageAdapter {
  public constructor(config: ConfigService) {
    const accountId = config.getOrThrow<string>('R2_ACCOUNT_ID');
    super({
      provider: 'cloudflare-r2',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      region: 'auto',
      accessKeyId: config.getOrThrow<string>('R2_ACCESS_KEY_ID'),
      secretAccessKey: config.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
      publicBaseUrl: config.getOrThrow<string>('R2_PUBLIC_BASE_URL'),
      forcePathStyle: false,
    });
  }
}
