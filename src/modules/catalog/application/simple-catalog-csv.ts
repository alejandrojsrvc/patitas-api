import { CatalogValidationError } from '../domain/errors/catalog.error';

export interface SimpleCatalogCsvRow {
  sku: string;
  barcode: string | null;
  name: string;
  slug: string;
  brand: string;
  category: string;
  species: string;
  line: string | null;
  lifeStage: string | null;
  breedSize: string | null;
  weightGrams: number;
  description: string | null;
  imageUrl: string | null;
  salePrice: string | null;
  initialStock: number | null;
}

const REQUIRED_HEADERS = ['name', 'brand', 'weight_kg'];

type CsvRecord = Record<string, string>;

export const parseSimpleCatalogCsv = (
  data: Uint8Array,
): SimpleCatalogCsvRow[] => {
  const rows = parseRows(new TextDecoder().decode(data));
  if (rows.length === 0) throw new CatalogValidationError('El CSV está vacío.');

  const headers = rows.shift()!.map((header) =>
    header
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase(),
  );
  const missing = REQUIRED_HEADERS.filter(
    (header) => !headers.includes(header),
  );
  if (missing.length > 0) {
    throw new CatalogValidationError(
      `Faltan columnas obligatorias: ${missing.join(', ')}.`,
    );
  }

  const seenSkus = new Set<string>();
  const seenBarcodes = new Set<string>();
  const seenProductWeights = new Set<string>();
  return rows
    .filter((values) => values.some((value) => value.trim() !== ''))
    .map((values, index) => {
      if (values.length !== headers.length) {
        throw new CatalogValidationError(
          `La fila ${index + 2} tiene ${values.length} columnas; se esperaban ${headers.length}.`,
        );
      }
      const row = Object.fromEntries(
        headers.map((header, headerIndex) => [
          header,
          values[headerIndex].trim(),
        ]),
      );
      const parsed = mapRow(row, index + 2);
      if (seenSkus.has(parsed.sku)) {
        throw new CatalogValidationError(`El SKU ${parsed.sku} está repetido.`);
      }
      seenSkus.add(parsed.sku);
      if (parsed.barcode && seenBarcodes.has(parsed.barcode)) {
        throw new CatalogValidationError(
          `El EAN/GTIN ${parsed.barcode} está repetido.`,
        );
      }
      if (parsed.barcode) seenBarcodes.add(parsed.barcode);
      const productWeight = `${parsed.slug}:${parsed.weightGrams}`;
      if (seenProductWeights.has(productWeight)) {
        throw new CatalogValidationError(
          `El producto ${parsed.slug} repite el peso ${parsed.weightGrams} g.`,
        );
      }
      seenProductWeights.add(productWeight);
      return parsed;
    });
};

const mapRow = (row: CsvRecord, rowNumber: number): SimpleCatalogCsvRow => {
  const required = (key: string): string => {
    const value = row[key]?.trim();
    if (!value)
      throw new CatalogValidationError(`La fila ${rowNumber} no tiene ${key}.`);
    return value;
  };
  const weightKg = Number(required('weight_kg').replace(',', '.'));
  if (
    !Number.isFinite(weightKg) ||
    weightKg <= 0 ||
    !Number.isInteger(weightKg * 1000)
  ) {
    throw new CatalogValidationError(
      `La fila ${rowNumber} tiene un peso inválido.`,
    );
  }
  const salePrice = optionalNumber(row.sale_price, rowNumber, 'sale_price');
  const initialStock = optionalInteger(
    row.initial_stock,
    rowNumber,
    'initial_stock',
  );
  const barcode = normalizeBarcode(row.barcode || row.ean, rowNumber);
  const imageUrl = row.image_url?.trim() || null;
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    throw new CatalogValidationError(
      `La fila ${rowNumber} tiene una imagen inválida.`,
    );
  }
  return {
    sku:
      row.sku?.trim().toUpperCase() ||
      generateSku(row.brand, row.name, Math.round(weightKg * 1000)),
    barcode,
    name: required('name'),
    slug: slugify(row.slug?.trim() || row.name),
    brand: required('brand'),
    category: row.category?.trim() || 'alimento-seco',
    species: row.species?.trim().toLowerCase() || inferSpecies(row.name),
    line: row.line?.trim() || null,
    lifeStage: row.life_stage?.trim().toLowerCase() || null,
    breedSize: row.breed_size?.trim().toLowerCase() || null,
    weightGrams: Math.round(weightKg * 1000),
    description: row.description?.trim() || null,
    imageUrl,
    salePrice,
    initialStock,
  };
};

const optionalNumber = (
  value: string | undefined,
  rowNumber: number,
  field: string,
): string | null => {
  if (!value?.trim()) return null;
  const number = Number(value.replace(',', '.'));
  if (!Number.isFinite(number) || number < 0) {
    throw new CatalogValidationError(
      `La fila ${rowNumber} tiene ${field} inválido.`,
    );
  }
  return number.toFixed(2);
};

const optionalInteger = (
  value: string | undefined,
  rowNumber: number,
  field: string,
): number | null => {
  if (!value?.trim()) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new CatalogValidationError(
      `La fila ${rowNumber} tiene ${field} inválido.`,
    );
  }
  return number;
};

const normalizeBarcode = (
  value: string | undefined,
  rowNumber: number,
): string | null => {
  if (!value?.trim()) return null;
  const barcode = value.replace(/[\s-]/g, '');
  if (!/^\d{8,14}$/.test(barcode)) {
    throw new CatalogValidationError(
      `La fila ${rowNumber} tiene un EAN/GTIN inválido.`,
    );
  }
  return barcode;
};

const inferSpecies = (name: string): string =>
  /gato|gatito|cat/i.test(name) ? 'gato' : 'perro';

const generateSku = (
  brand: string,
  name: string,
  weightGrams: number,
): string => {
  const compact = slugify(`${brand}-${name}`)
    .split('-')
    .filter(Boolean)
    .map((part) => part.slice(0, 3))
    .join('')
    .slice(0, 55)
    .toUpperCase();
  return `${compact || 'PRODUCTO'}-${weightGrams}G`;
};

const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const parseRows = (contents: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index];
    const next = contents[index + 1];
    if (quoted) {
      if (character === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else field += character;
  }
  if (quoted)
    throw new CatalogValidationError(
      'El CSV termina dentro de un campo entrecomillado.',
    );
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
};
