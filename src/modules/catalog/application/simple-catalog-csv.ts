import { CatalogValidationError } from '../domain/errors/catalog.error';
import type { SupplierStockStatus } from '../domain/catalog.types';

export interface SimpleCatalogCsvRow {
  rowNumber: number;
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
  weightGrams: number | null;
  description: string | null;
  imageUrl: string | null;
  salePrice: string | null;
  initialStock: number | null;
  supplierName: string | null;
  supplierSku: string | null;
  supplierUnitCost: string | null;
  supplierStockStatus: SupplierStockStatus;
}

const REQUIRED_HEADERS = ['name', 'brand'];

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
      const productWeight = `${parsed.slug}:${parsed.weightGrams ?? 'unit'}`;
      if (seenProductWeights.has(productWeight)) {
        throw new CatalogValidationError(
          `El producto ${parsed.slug} repite la presentación ${parsed.weightGrams ?? 'unit'}.`,
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
  const weightKg = optionalWeight(row.weight_kg, rowNumber);
  const weightGrams = weightKg === null ? null : Math.round(weightKg * 1000);
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
  const supplierName = optional(row.supplier || row.supplier_name);
  const supplierSku = optional(row.supplier_product_name || row.supplier_sku);
  const supplierUnitCost = optionalSupplierCost(
    row.cost_price || row.unit_cost,
    rowNumber,
  );
  if (
    (supplierName || supplierSku || supplierUnitCost) &&
    (!supplierName || !supplierUnitCost)
  ) {
    throw new CatalogValidationError(
      `La fila ${rowNumber} debe tener supplier y cost_price para importar la oferta.`,
    );
  }
  const supplierStockStatus = parseSupplierStockStatus(
    row.supplier_stock_status || row.stock_status,
    rowNumber,
  );
  return {
    rowNumber,
    sku:
      row.sku?.trim().toUpperCase() ||
      generateSku(row.brand, row.name, weightGrams),
    barcode,
    name: required('name'),
    slug: slugify(row.slug?.trim() || row.name),
    brand: required('brand'),
    category: row.category?.trim() || 'alimento-seco',
    species: row.species?.trim().toLowerCase() || inferSpecies(row.name),
    line: row.line?.trim() || null,
    lifeStage: row.life_stage?.trim().toLowerCase() || null,
    breedSize: row.breed_size?.trim().toLowerCase() || null,
    weightGrams,
    description: row.description?.trim() || null,
    imageUrl,
    salePrice,
    initialStock,
    supplierName,
    supplierSku,
    supplierUnitCost,
    supplierStockStatus,
  };
};

const optionalWeight = (
  value: string | undefined,
  rowNumber: number,
): number | null => {
  if (!value?.trim()) return null;
  const weightKg = Number(value.replace(',', '.'));
  if (
    !Number.isFinite(weightKg) ||
    weightKg <= 0 ||
    !Number.isInteger(weightKg * 1000)
  ) {
    throw new CatalogValidationError(
      `La fila ${rowNumber} tiene un peso inválido.`,
    );
  }
  return weightKg;
};

const optional = (value: string | undefined): string | null =>
  value?.trim() || null;

const optionalSupplierCost = (
  value: string | undefined,
  rowNumber: number,
): string | null => {
  if (!value?.trim()) return null;
  const normalized = value.replace(',', '.').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized) || Number(normalized) <= 0) {
    throw new CatalogValidationError(
      `La fila ${rowNumber} tiene cost_price inválido.`,
    );
  }
  return Number(normalized).toFixed(2);
};

const parseSupplierStockStatus = (
  value: string | undefined,
  rowNumber: number,
): SupplierStockStatus => {
  const normalized = value?.trim().toUpperCase() || 'AVAILABLE';
  if (
    !['AVAILABLE', 'OUT_OF_STOCK', 'ON_REQUEST', 'UNKNOWN'].includes(normalized)
  ) {
    throw new CatalogValidationError(
      `La fila ${rowNumber} tiene supplier_stock_status inválido.`,
    );
  }
  return normalized as SupplierStockStatus;
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
  weightGrams: number | null,
): string => {
  const compact = slugify(`${brand}-${name}`)
    .split('-')
    .filter(Boolean)
    .map((part) => part.slice(0, 3))
    .join('')
    .slice(0, 55)
    .toUpperCase();
  return `${compact || 'PRODUCTO'}-${weightGrams === null ? 'UNIT' : `${weightGrams}G`}`;
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
