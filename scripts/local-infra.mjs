import { spawnSync } from 'node:child_process';

const action = process.argv[2];
const commands = {
  stop: ['down'],
  status: ['ps'],
  reset: ['down', '--volumes'],
};

if (!action || (action !== 'start' && !(action in commands))) {
  console.error('Uso: node scripts/local-infra.mjs <start|stop|status|reset>');
  process.exit(1);
}

if (action === 'reset' && process.env['NODE_ENV'] === 'production') {
  throw new Error('infra:reset está bloqueado en production.');
}

const runCompose = (args) => {
  const result = spawnSync('docker', ['compose', ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

if (action === 'start') {
  runCompose(['up', '--detach', '--wait', 'postgres', 'minio']);
  runCompose(['run', '--rm', 'minio-init']);
} else {
  runCompose(commands[action]);
}
