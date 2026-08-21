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

  private error(operation: string, cause: unknown): ProviderOperationError {
    return new ProviderOperationError(
      'supabase',
      operation,
      `Supabase Storage no pudo completar ${operation}.`,
      cause instanceof Error ? { cause } : undefined,
    );
  }
}
