import type { ConfigService } from '@nestjs/config';
import { MinioStorageAdapter } from '../../src/infrastructure/storage/minio/minio-storage.adapter';

const values: Record<string, string | boolean> = {
  MINIO_ENDPOINT: process.env['MINIO_ENDPOINT'] ?? 'http://127.0.0.1:59000',
  MINIO_REGION: process.env['MINIO_REGION'] ?? 'us-east-1',
  MINIO_ACCESS_KEY_ID: process.env['MINIO_ACCESS_KEY_ID'] ?? 'minioadmin',
  MINIO_SECRET_ACCESS_KEY: process.env['MINIO_SECRET_ACCESS_KEY'] ?? 'minioadmin',
  MINIO_PUBLIC_BASE_URL: process.env['MINIO_PUBLIC_BASE_URL'] ?? 'http://127.0.0.1:59000/product-media',
};
const config = {
  getOrThrow: (key: string) => {
    const value = values[key];
    if (value === undefined) throw new Error(`Missing ${key}`);
    return value;
  },
} as unknown as ConfigService;

describe('MinioStorageAdapter integration', () => {
  const storage = new MinioStorageAdapter(config);
  const publicObject = { bucket: 'product-media', path: 'tests/storage.txt' };
  const privateObject = { bucket: 'payment-proofs', path: 'tests/storage.txt' };

  afterAll(async () => {
    await Promise.all([storage.delete(publicObject), storage.delete(privateObject)]);
  });

  it('serves public objects and signs private objects', async () => {
    const data = Buffer.from('patitas-storage-test');
    await storage.upload({ object: publicObject, data, contentType: 'text/plain', upsert: true });
    await storage.upload({ object: privateObject, data, contentType: 'text/plain', upsert: true });

    const publicResponse = await fetch(storage.getPublicUrl(publicObject));
    expect(publicResponse.status).toBe(200);
    expect(await publicResponse.text()).toBe(data.toString());

    const signedResponse = await fetch(await storage.getSignedUrl(privateObject, 60));
    expect(signedResponse.status).toBe(200);
    expect(await signedResponse.text()).toBe(data.toString());
  });
});
