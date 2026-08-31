export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export interface StoredObject {
  bucket: string;
  path: string;
}

export interface UploadObjectInput {
  object: StoredObject;
  data: Uint8Array;
  contentType?: string;
  upsert?: boolean;
}

export interface StorageProvider {
  upload(input: UploadObjectInput): Promise<StoredObject>;
  delete(object: StoredObject): Promise<void>;
  getSignedUrl(object: StoredObject, expiresInSeconds: number): Promise<string>;
  getSignedUrls(
    objects: StoredObject[],
    expiresInSeconds: number,
  ): Promise<string[]>;
  getPublicUrl(object: StoredObject): string;
}
