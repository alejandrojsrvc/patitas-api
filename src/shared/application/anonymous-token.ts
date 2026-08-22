import { createHash, randomBytes } from 'node:crypto';

export const createAnonymousToken = (): string =>
  randomBytes(32).toString('hex');

export const hashAnonymousToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
