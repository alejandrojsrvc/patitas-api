import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runBrandResearch, runResearch } from './run';

const args = process.argv.slice(2).filter((argument) => argument !== '--');
const manifest = args[0];
const output =
  args[1] ?? resolve('artifacts/catalog-research/latest.json');

if (!manifest) {
  console.error('Uso: pnpm catalog:research -- <manifest.json> [salida.json]');
  process.exit(1);
}

const main = async (): Promise<void> => {
  const input = JSON.parse(await readFile(manifest, 'utf8')) as {
    schemaVersion?: string;
  };
  const result =
    input.schemaVersion === 'catalog-research.brand.v1'
      ? await runBrandResearch(manifest, output)
      : await runResearch(manifest, output);
  console.log(
    `Investigación ${result.runId}: ${result.products.length} productos, ${result.errors.length} errores.`,
  );
};

main().catch((error: unknown) => {
    console.error(
      error instanceof Error
        ? error.message
        : 'No se pudo ejecutar la investigación.',
    );
    process.exit(1);
  });
