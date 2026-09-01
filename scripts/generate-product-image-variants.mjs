import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { basename, extname, join, relative, resolve } from 'node:path';
import sharp from 'sharp';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const VARIANTS = [
  { name: 'catalog-320', width: 320, quality: 75 },
  { name: 'catalog-640', width: 640, quality: 75 },
  { name: 'detail-1000', width: 1000, quality: 82 },
];

const args = parseArguments(process.argv.slice(2));
const inputDirectory = resolve(args.input ?? 'exports/product-images');
const outputDirectory = resolve(
  args.output ?? join(inputDirectory, 'optimized'),
);

if (inputDirectory === outputDirectory) {
  throw new Error('La carpeta de salida debe ser distinta de la entrada.');
}

const files = (await readdir(inputDirectory, { withFileTypes: true }))
  .filter(
    (entry) =>
      entry.isFile() && IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase()),
  )
  .map((entry) => {
    const fileExtension = extname(entry.name).toLowerCase();
    return {
      fileName: entry.name,
      filePath: join(inputDirectory, entry.name),
      sku: basename(entry.name, fileExtension),
      extension: fileExtension.slice(1),
    };
  })
  .sort((left, right) => left.sku.localeCompare(right.sku));

if (files.length === 0) {
  throw new Error(`No hay imágenes compatibles en ${inputDirectory}.`);
}

const duplicateSkus = findDuplicates(files.map(({ sku }) => sku));
if (duplicateSkus.length > 0) {
  throw new Error(`Hay SKU duplicados: ${duplicateSkus.join(', ')}`);
}

const entries = [];
for (const file of files) {
  const metadata = await sharp(file.filePath).metadata();
  const sourceStats = await stat(file.filePath);
  const sourceFormat = metadata.format ?? file.extension;
  const variants = VARIANTS.map((variant) => ({
    ...variant,
    fileName: `${variant.name}.webp`,
    relativePath: join('optimized', file.sku, `${variant.name}.webp`),
    outputPath: join(outputDirectory, file.sku, `${variant.name}.webp`),
  }));

  entries.push({
    sku: file.sku,
    source: {
      fileName: file.fileName,
      relativePath: relative(inputDirectory, file.filePath),
      format: sourceFormat,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      bytes: sourceStats.size,
    },
    variants,
  });
}

const existingOutputs = [];
if (!args.dryRun) {
  for (const entry of entries) {
    for (const variant of entry.variants) {
      try {
        await stat(variant.outputPath);
        existingOutputs.push(variant.relativePath);
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    }
  }
}

if (existingOutputs.length > 0 && !args.force) {
  throw new Error(
    `Ya existen ${existingOutputs.length} variantes. Usa --force para regenerarlas. ` +
      `Primeros archivos: ${existingOutputs.slice(0, 5).join(', ')}`,
  );
}

if (args.dryRun) {
  console.log(
    JSON.stringify(
      {
        mode: 'dry-run',
        inputDirectory,
        outputDirectory,
        sources: files.length,
        plannedVariants: files.length * VARIANTS.length,
        variants: VARIANTS,
        candidatesExcluded: true,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

await mkdir(outputDirectory, { recursive: true });

let generatedVariants = 0;
let totalSourceBytes = 0;
let totalVariantBytes = 0;
for (const entry of entries) {
  await mkdir(join(outputDirectory, entry.sku), { recursive: true });
  totalSourceBytes += entry.source.bytes;

  for (const variant of entry.variants) {
    await sharp(join(inputDirectory, entry.source.relativePath))
      .rotate()
      .resize({
        width: variant.width,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: variant.quality, effort: 5, smartSubsample: true })
      .toFile(variant.outputPath);

    const outputStats = await stat(variant.outputPath);
    const outputMetadata = await sharp(variant.outputPath).metadata();
    const outputHash = await sha256(variant.outputPath);
    variant.width = outputMetadata.width ?? null;
    variant.height = outputMetadata.height ?? null;
    variant.bytes = outputStats.size;
    variant.sha256 = outputHash;
    delete variant.outputPath;
    totalVariantBytes += outputStats.size;
    generatedVariants += 1;
  }

  console.log(
    `[${generatedVariants}/${files.length * VARIANTS.length}] ${entry.sku}`,
  );
}

const manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  inputDirectory,
  outputDirectory,
  format: 'webp',
  processing: {
    preserveAspectRatio: true,
    crop: false,
    withoutEnlargement: true,
    orientation: 'exif-rotate',
  },
  variants: VARIANTS,
  summary: {
    sources: entries.length,
    generatedVariants,
    sourceBytes: totalSourceBytes,
    variantBytes: totalVariantBytes,
    savedBytesComparedWithOneVariantPerSource:
      totalSourceBytes * VARIANTS.length - totalVariantBytes,
    variantBytesComparedWithAllOriginals: totalSourceBytes * VARIANTS.length,
  },
  entries: entries.map((entry) => ({
    sku: entry.sku,
    source: entry.source,
    variants: entry.variants,
  })),
};

await writeFile(
  join(outputDirectory, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

console.log(
  JSON.stringify(
    {
      mode: args.force ? 'generated-forced' : 'generated',
      inputDirectory,
      outputDirectory,
      ...manifest.summary,
      manifest: join(outputDirectory, 'manifest.json'),
    },
    null,
    2,
  ),
);

/**
 * @param {string[]} values
 * @returns {{ dryRun: boolean, force: boolean, input?: string, output?: string }}
 */
function parseArguments(values) {
  /** @type {{ dryRun: boolean, force: boolean, input?: string, output?: string }} */
  const result = { dryRun: false, force: false };
  for (const value of values) {
    if (value === '--') continue;
    if (value === '--dry-run') {
      result.dryRun = true;
      continue;
    }
    if (value === '--force') {
      result.force = true;
      continue;
    }
    const match = value.match(/^--(input|output)=(.+)$/);
    if (match) {
      result[match[1]] = match[2];
      continue;
    }
    throw new Error(`Argumento no reconocido: ${value}`);
  }
  return result;
}

/** @param {string[]} values @returns {string[]} */
function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    const normalized = value.toLowerCase();
    if (seen.has(normalized)) duplicates.add(value);
    seen.add(normalized);
  }
  return [...duplicates].sort();
}

function isNotFound(error) {
  return error?.code === 'ENOENT';
}

async function sha256(filePath) {
  return createHash('sha256')
    .update(await readFile(filePath))
    .digest('hex');
}
