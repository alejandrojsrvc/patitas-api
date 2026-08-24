import { config as loadEnv } from 'dotenv';

export const loadProjectEnv = (): void => {
  const testFile = process.env['NODE_ENV'] === 'test' ? '.env.test' : null;
  loadEnv({
    path: [testFile, '.env.local', '.env.dist'].filter(
      (value): value is string => Boolean(value),
    ),
    quiet: true,
  });
};
