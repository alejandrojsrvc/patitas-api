import { Injectable } from '@nestjs/common';
import { ProviderOperationError } from '../../../shared/application/provider-error';
import type {
  StoredObject,
  StorageProvider,
  UploadObjectInput,
} from '../../../shared/application/ports/storage-provider.interface';
import { SupabaseAdminClient } from './supabase-admin.client';

@Injectable()
export class SupabaseStorageAdapter implements StorageProvider {
  public constructor(private readonly adminClient: SupabaseAdminClient) {}

  public async upload(input: UploadObjectInput): Promise<StoredObject> {
    const { data, error } = await this.adminClient.client.storage
      .from(input.object.bucket)
      .upload(input.object.path, input.data, {
        contentType: input.contentType,
        cacheControl: '31536000',
        upsert: input.upsert ?? false,
      });

    if (error || !data) {
      throw this.error('upload', error);
    }

    return { bucket: input.object.bucket, path: data.path };
  }

  public async delete(object: StoredObject): Promise<void> {
    const { error } = await this.adminClient.client.storage
      .from(object.bucket)
      .remove([object.path]);

    if (error) {
      throw this.error('delete', error);
    }
  }

  public async getSignedUrl(
    object: StoredObject,
    expiresInSeconds: number,
  ): Promise<string> {
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds <= 0) {
      throw new ProviderOperationError(
        'storage',
        'getSignedUrl',
        'expiresInSeconds debe ser un entero positivo.',
      );
    }

    const { data, error } = await this.adminClient.client.storage
      .from(object.bucket)
      .createSignedUrl(object.path, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw this.error('getSignedUrl', error);
    }

    return data.signedUrl;
  }

  public async getSignedUrls(
    objects: StoredObject[],
    expiresInSeconds: number,
  ): Promise<string[]> {
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds <= 0) {
      throw new ProviderOperationError(
        'storage',
        'getSignedUrls',
        'expiresInSeconds debe ser un entero positivo.',
      );
    }
    if (!objects.length) return [];

    const grouped = new Map<string, StoredObject[]>();
    for (const object of objects) {
      const bucketObjects = grouped.get(object.bucket);
      if (bucketObjects) bucketObjects.push(object);
      else grouped.set(object.bucket, [object]);
    }
    const signedByObject = new Map<string, string>();

    await Promise.all(
      Array.from(grouped.entries()).map(async ([bucket, bucketObjects]) => {
        const paths = Array.from(
          new Set(bucketObjects.map((object) => object.path)),
        );
        const { data, error } = await this.adminClient.client.storage
          .from(bucket)
          .createSignedUrls(paths, expiresInSeconds);

        if (error || !data || data.length !== paths.length) {
          throw this.error('getSignedUrls', error);
        }

        data.forEach((result, index) => {
          if (!result.signedUrl) {
            throw this.error('getSignedUrls', result.error);
          }
          signedByObject.set(
            storageObjectKey(bucket, paths[index]),
            result.signedUrl,
          );
        });
      }),
    );

    return objects.map((object) => {
      const signedUrl = signedByObject.get(
        storageObjectKey(object.bucket, object.path),
      );
      if (!signedUrl) throw this.error('getSignedUrls', undefined);
      return signedUrl;
    });
  }

  public getPublicUrl(object: StoredObject): string {
    const { data } = this.adminClient.client.storage
      .from(object.bucket)
      .getPublicUrl(object.path);
    if (!data.publicUrl) throw this.error('getPublicUrl', undefined);
    return data.publicUrl;
  }

  private error(operation: string, cause: unknown): ProviderOperationError {
    return new ProviderOperationError(
      'supabase',
      operation,
      `Supabase Storage no pudo completar ${operation}.`,
      cause instanceof Error ? { cause } : undefined,
    );
  }
}

const storageObjectKey = (bucket: string, path: string) =>
  `${bucket}\u0000${path}`;
