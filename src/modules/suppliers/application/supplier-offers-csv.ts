import type {
  SupplierOfferImportRow,
  SupplierOfferStockStatus,
} from '../domain/supplier.types';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STOCK_STATUSES = new Set<SupplierOfferStockStatus>([
  'AVAILABLE',
  'OUT_OF_STOCK',
  'ON_REQUEST',
  'UNKNOWN',
]);

export const parseSupplierOffersCsv = (
  data: Uint8Array,
): SupplierOfferImportRow[] => {
  const rows = parseRows(new TextDecoder().decode(data));
  if (rows.length === 0) throw new Error('El CSV está vacío.');

  const headers = rows.shift()!.map((header) =>
    header
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase(),
  );
  const missing = ['unit_cost'].filter((header) => !headers.includes(header));
  if (!headers.includes('supplier_id') && !headers.includes('supplier_name'))
    missing.push('supplier_id o supplier_name');
  if (
    !headers.includes('variant_id') &&
    !headers.includes('sku') &&
    !headers.includes('barcode') &&
    !headers.includes('ean')
  )
    missing.push('variant_id, sku o barcode');
  if (missing.length > 0)
    throw new Error(`Faltan columnas obligatorias: ${missing.join(', ')}.`);

  return rows
    .filter((values) => values.some((value) => value.trim() !== ''))
    .map((values, index) => {
      const rowNumber = index + 2;
      if (values.length !== headers.length)
        throw new Error(
          `La fila ${rowNumber} tiene ${values.length} columnas; se esperaban ${headers.length}.`,
        );
      const row = Object.fromEntries(
        headers.map((header, headerIndex) => [
          header,
          values[headerIndex].trim(),
        ]),
      );
      return mapRow(row, rowNumber);
    });
};

type CsvRecord = Record<string, string>;

const mapRow = (row: CsvRecord, rowNumber: number): SupplierOfferImportRow => {
  const supplierId = optional(row.supplier_id);
  if (supplierId && !UUID_PATTERN.test(supplierId))
    throw new Error(`La fila ${rowNumber} tiene un supplier_id inválido.`);
  const variantId = optional(row.variant_id);
  if (variantId && !UUID_PATTERN.test(variantId))
    throw new Error(`La fila ${rowNumber} tiene un variant_id inválido.`);

  const supplierName = optional(row.supplier_name || row.supplier);
  if (!supplierId && !supplierName)
    throw new Error(
      `La fila ${rowNumber} debe indicar supplier_id o supplier_name.`,
    );
  const sku = optional(row.sku || row.variant_sku);
  const barcode = normalizeBarcode(row.barcode || row.ean, rowNumber);
  if (!variantId && !sku && !barcode)
    throw new Error(
      `La fila ${rowNumber} debe indicar variant_id, sku o barcode.`,
    );

  const unitCost = parseMoney(row.unit_cost, rowNumber, 'unit_cost');
  const stockStatus = (optional(row.stock_status)?.toUpperCase() ??
    'UNKNOWN') as SupplierOfferStockStatus;
  if (!STOCK_STATUSES.has(stockStatus))
    throw new Error(`La fila ${rowNumber} tiene un stock_status inválido.`);

  return {
    rowNumber,
    supplierId,
    supplierName,
    variantId,
    sku,
    barcode,
    supplierSku: optional(row.supplier_sku),
    unitCost,
    stockStatus,
    leadTimeHours: parseOptionalInteger(
      row.lead_time_hours,
      rowNumber,
      'lead_time_hours',
      0,
    ),
    minimumQuantity: parseInteger(
      row.minimum_quantity || '1',
      rowNumber,
      'minimum_quantity',
      1,
    ),
    active: parseBoolean(row.active, rowNumber),
  };
};

const optional = (value: string | undefined): string | null =>
  value?.trim() || null;

const parseMoney = (
  value: string | undefined,
  rowNumber: number,
  field: string,
): string => {
  const normalized = value?.trim().replace(',', '.');
  if (!normalized || !/^\d+(\.\d{1,2})?$/.test(normalized))
    throw new Error(`La fila ${rowNumber} tiene ${field} inválido.`);
  if (Number(normalized) <= 0)
    throw new Error(`La fila ${rowNumber} tiene ${field} inválido.`);
  return Number(normalized).toFixed(2);
};

const parseOptionalInteger = (
  value: string | undefined,
  rowNumber: number,
  field: string,
  minimum: number,
): number | null => {
  if (!value?.trim()) return null;
  return parseInteger(value, rowNumber, field, minimum);
};

const parseInteger = (
  value: string,
  rowNumber: number,
  field: string,
  minimum: number,
): number => {
  const number = Number(value.trim());
  if (!Number.isInteger(number) || number < minimum)
    throw new Error(`La fila ${rowNumber} tiene ${field} inválido.`);
  return number;
};

const parseBoolean = (
  value: string | undefined,
  rowNumber: number,
): boolean => {
  if (!value?.trim()) return true;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'si', 'sí', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  throw new Error(`La fila ${rowNumber} tiene active inválido.`);
};

const normalizeBarcode = (
  value: string | undefined,
  rowNumber: number,
): string | null => {
  if (!value?.trim()) return null;
  const barcode = value.replace(/[\s-]/g, '');
  if (!/^\d{8,14}$/.test(barcode))
    throw new Error(`La fila ${rowNumber} tiene un barcode inválido.`);
  return barcode;
};

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
    throw new Error('El CSV termina dentro de un campo entrecomillado.');
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
};
