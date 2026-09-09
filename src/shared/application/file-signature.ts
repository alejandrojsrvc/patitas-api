const signatures: Array<{ contentType: string; matches: (data: Uint8Array) => boolean }> = [
  { contentType: 'image/jpeg', matches: (data) => startsWith(data, [0xff, 0xd8, 0xff]) },
  { contentType: 'image/png', matches: (data) => startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { contentType: 'image/gif', matches: (data) => text(data, 0, 6) === 'GIF87a' || text(data, 0, 6) === 'GIF89a' },
  { contentType: 'image/webp', matches: (data) => text(data, 0, 4) === 'RIFF' && text(data, 8, 4) === 'WEBP' },
  { contentType: 'application/pdf', matches: (data) => text(data, 0, 5) === '%PDF-' },
];

export const detectFileContentType = (data: Uint8Array): string | null =>
  signatures.find((signature) => signature.matches(data))?.contentType ?? null;

const startsWith = (data: Uint8Array, expected: number[]): boolean => expected.every((value, index) => data[index] === value);

const text = (data: Uint8Array, offset: number, length: number): string => Buffer.from(data.subarray(offset, offset + length)).toString('ascii');
