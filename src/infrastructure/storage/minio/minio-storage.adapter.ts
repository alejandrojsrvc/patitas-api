import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3StorageAdapter } from '../s3/s3-storage.adapter';

@Injectable()
export class MinioStorageAdapter extends S3StorageAdapter {
  public constructor(config: ConfigService) {
    super({
      provider: 'minio',
      endpoint: config.getOrThrow<string>('MINIO_ENDPOINT'),
      region: config.getOrThrow<string>('MINIO_REGION'),
      accessKeyId: config.getOrThrow<string>('MINIO_ACCESS_KEY_ID'),
      secretAccessKey: config.getOrThrow<string>('MINIO_SECRET_ACCESS_KEY'),
      publicBaseUrl: config.getOrThrow<string>('MINIO_PUBLIC_BASE_URL'),
      forcePathStyle: true,
    });
  }
}
