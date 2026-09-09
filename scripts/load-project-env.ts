import { config as loadEnv } from 'dotenv';

export const loadProjectEnv = (): void => {
  if (process.env['NODE_ENV'] === 'production') return;

  const testFile = process.env['NODE_ENV'] === 'test' ? '.env.test' : null;
  loadEnv({
    path: [testFile, '.env.local'].filter((value): value is string => Boolean(value)),
    quiet: true,
  });
};
