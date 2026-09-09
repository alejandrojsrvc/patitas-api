import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ProviderOperationError } from '../../../shared/application/provider-error';
import type { StoredObject, StorageProvider, UploadObjectInput } from '../../../shared/application/ports/storage-provider.interface';

const PUBLIC_BUCKET = 'product-media';

export interface S3StorageOptions {
  provider: 'cloudflare-r2' | 'minio';
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
  forcePathStyle: boolean;
}

export class S3StorageAdapter implements StorageProvider {
  private readonly client: S3Client;
  private readonly publicBaseUrl: string;

  public constructor(private readonly options: S3StorageOptions) {
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
    this.publicBaseUrl = options.publicBaseUrl.replace(/\/+$/, '');
  }

  public async upload(input: UploadObjectInput): Promise<StoredObject> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: input.object.bucket,
          Key: input.object.path,
          Body: input.data,
          ContentType: input.contentType,
          CacheControl: input.object.bucket === PUBLIC_BUCKET ? 'public, max-age=31536000, immutable' : 'private, no-store',
          IfNoneMatch: input.upsert ? undefined : '*',
        }),
      );
      return input.object;
    } catch (cause) {
      throw this.error('upload', cause);
    }
  }

  public async delete(object: StoredObject): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: object.bucket, Key: object.path }));
    } catch (cause) {
      throw this.error('delete', cause);
    }
  }

  public async getSignedUrl(object: StoredObject, expiresInSeconds: number): Promise<string> {
    this.validateExpiration(expiresInSeconds, 'getSignedUrl');
    try {
      return await getSignedUrl(this.client, new GetObjectCommand({ Bucket: object.bucket, Key: object.path }), { expiresIn: expiresInSeconds });
    } catch (cause) {
      throw this.error('getSignedUrl', cause);
    }
  }

  public getSignedUrls(objects: StoredObject[], expiresInSeconds: number): Promise<string[]> {
    this.validateExpiration(expiresInSeconds, 'getSignedUrls');
    return Promise.all(objects.map((object) => this.getSignedUrl(object, expiresInSeconds)));
  }

  public getPublicUrl(object: StoredObject): string {
    if (object.bucket !== PUBLIC_BUCKET) {
      throw new ProviderOperationError(this.options.provider, 'getPublicUrl', `El bucket ${object.bucket} no admite acceso público.`);
    }
    const path = object.path
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    return `${this.publicBaseUrl}/${path}`;
  }

  private validateExpiration(expiresInSeconds: number, operation: string): void {
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds <= 0) {
      throw new ProviderOperationError(this.options.provider, operation, 'expiresInSeconds debe ser un entero positivo.');
    }
  }

  private error(operation: string, cause: unknown): ProviderOperationError {
    return new ProviderOperationError(
      this.options.provider,
      operation,
      `${this.options.provider} no pudo completar ${operation}.`,
      cause instanceof Error ? { cause } : undefined,
    );
  }
}
