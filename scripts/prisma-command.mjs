import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2).filter((arg) => arg !== '--');

if (args.length === 0) {
  throw new Error('Debe indicarse un comando Prisma.');
}

const executable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(executable, ['exec', 'prisma', ...args], {
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
