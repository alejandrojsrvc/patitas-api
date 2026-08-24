import type { CompositionEntry, FeedingGuideEntry } from './types';

export const normalizeMoney = (
  value: string | number | null | undefined,
): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (!value) return null;
  const cleaned = value
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const normalizeWeightGrams = (
  value: string | number | null | undefined,
): number | null => {
  if (typeof value === 'number') return value > 0 ? Math.round(value) : null;
  if (!value) return null;
  const match = value
    .replace(',', '.')
    .match(/(\d+(?:\.\d+)?)\s*(kg|kilos?|g|gr)/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(
    match[2].toLowerCase().startsWith('k') ? amount * 1000 : amount,
  );
};

export const normalizeAttribute = (
  value: string | null | undefined,
): string | null => {
  const normalized = value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return normalized || null;
};

export const parseWeightRange = (
  value: string,
): {
  min: number;
  max: number | null;
} | null => {
  const open = value.match(
    /(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?)?\.?\s*(?:o más|en adelante|\+)/i,
  );
  if (open) return { min: Number(open[1].replace(',', '.')), max: null };
  const range = value.match(/(\d+(?:[.,]\d+)?)\s*[-a]\s*(\d+(?:[.,]\d+)?)/i);
  if (range) {
    return {
      min: Number(range[1].replace(',', '.')),
      max: Number(range[2].replace(',', '.')),
    };
  }
  const single = value.match(/(\d+(?:[.,]\d+)?)/);
  return single
    ? { min: Number(single[1].replace(',', '.')), max: null }
    : null;
};

export const parseDailyRange = (
  value: string,
): { min: number; max: number | null } | null => {
  const open = value.match(
    /(\d+(?:[.,]\d+)?)\s*(?:g|gr|gramos?)?\.?\s*(?:o más|en adelante|\+)/i,
  );
  if (open) return { min: Number(open[1].replace(',', '.')), max: null };
  const range = value.match(/(\d+(?:[.,]\d+)?)\s*[-a]\s*(\d+(?:[.,]\d+)?)/i);
  if (range) {
    return {
      min: Number(range[1].replace(',', '.')),
      max: Number(range[2].replace(',', '.')),
    };
  }
  const single = value.match(/(\d+(?:[.,]\d+)?)/);
  return single
    ? { min: Number(single[1].replace(',', '.')), max: null }
    : null;
};

export const parseFeedingRows = (rows: string[]): FeedingGuideEntry[] => {
  const result: FeedingGuideEntry[] = [];
  for (const row of rows) {
    const [rawWeight, rawDailyAmount] = row
      .split('|')
      .map((item) => item.trim());
    if (!rawWeight || !rawDailyAmount) continue;
    const weight = parseWeightRange(rawWeight);
    const daily = parseDailyRange(rawDailyAmount);
    if (!weight || !daily || weight.min <= 0 || daily.min <= 0) continue;
    result.push({
      petWeightKgMin: weight.min,
      petWeightKgMax: weight.max,
      lifeStage: null,
      conditions: {},
      dailyGramsMin: daily.min,
      dailyGramsMax: daily.max,
      rawWeight,
      rawDailyAmount,
    });
  }
  return result;
};

export const parseFeedingTables = (tables: string[][]): FeedingGuideEntry[] => {
  const simpleRows = tables
    .flat()
    .filter((row) =>
      /^\s*\d+(?:[.,]\d+)?\s*(?:-\s*\d+(?:[.,]\d+)?\s*)?(?:kg|kilos?)/i.test(
        row,
      ),
    );
  const entries = parseFeedingRows(simpleRows);
  for (const table of tables) {
    const standardHeaderIndex = table.findIndex((row) => {
      const cells = row.split('|').map((cell) => cell.trim());
      return (
        cells.length === 2 &&
        /peso|edad|semana|meses?/i.test(cells[0]) &&
        /gramos?|g\b/i.test(cells[1])
      );
    });
    if (standardHeaderIndex >= 0) {
      const headerCells = table[standardHeaderIndex]
        .split('|')
        .map((cell) => cell.trim());
      for (const row of table.slice(standardHeaderIndex + 1)) {
        const cells = row.split('|').map((cell) => cell.trim());
        if (cells.length < 2) continue;
        const weight = parseWeightRange(cells[0]);
        const daily = parseDailyRange(cells[1]);
        if (!weight || daily === null || daily.min <= 0) continue;
        entries.push({
          petWeightKgMin: weight.min,
          petWeightKgMax: weight.max,
          lifeStage: null,
          conditions: /edad|semana|meses?/i.test(headerCells[0])
            ? { age: cells[0] }
            : {},
          dailyGramsMin: daily.min,
          dailyGramsMax: daily.max,
          rawWeight: cells[0],
          rawDailyAmount: cells[1],
        });
      }
    }
    const headerIndex = table.findIndex((row) => {
      const cells = row.split('|').map((cell) => cell.trim());
      return (
        cells.length > 2 &&
        !/^\d/.test(cells[0]) &&
        /peso|actividad/i.test(cells[0]) &&
        cells.slice(1).some((cell) => parseWeightRange(cell))
      );
    });
    if (headerIndex < 0) continue;
    const header = table[headerIndex].split('|').map((cell) => cell.trim());
    const weights = header.slice(1).map(parseWeightRange);
    if (!weights.some(Boolean)) continue;
    for (const row of table.slice(headerIndex + 1)) {
      const cells = row.split('|').map((cell) => cell.trim());
      if (cells.length < 2) continue;
      cells.slice(1).forEach((dailyValue, index) => {
        const weight = weights[index];
        const daily = parseDailyRange(dailyValue);
        if (!weight || !daily || weight.min <= 0 || daily.min <= 0) return;
        entries.push({
          petWeightKgMin: weight.min,
          petWeightKgMax: weight.max,
          lifeStage: null,
          conditions: cells[0] ? { activity: cells[0] } : {},
          dailyGramsMin: daily.min,
          dailyGramsMax: daily.max,
          rawWeight: header[index + 1] ?? '',
          rawDailyAmount: dailyValue,
        });
      });
    }
  }
  return entries.filter(
    (entry, index, values) =>
      values.findIndex(
        (candidate) =>
          candidate.petWeightKgMin === entry.petWeightKgMin &&
          candidate.petWeightKgMax === entry.petWeightKgMax &&
          candidate.dailyGramsMin === entry.dailyGramsMin &&
          candidate.dailyGramsMax === entry.dailyGramsMax &&
          JSON.stringify(candidate.conditions) ===
            JSON.stringify(entry.conditions),
      ) === index,
  );
};

export const parseCompositionRows = (rows: string[]): CompositionEntry[] => {
  const result: CompositionEntry[] = [];
  for (const row of rows) {
    const cells = row.split('|').map((item) => item.trim());
    if (cells.length < 2 || /^ingredientes$/i.test(cells[0])) continue;
    const values = cells.slice(1).filter(Boolean);
    const numbers = values
      .map(parsePercentOrNumber)
      .filter((item): item is number => item !== null);
    if (numbers.length === 0 && !/energía|em\b/i.test(cells[0])) continue;
    result.push({
      name: cells[0],
      minimum: numbers[0] ?? null,
      maximum: numbers[1] ?? null,
      unit: /energía|em\b/i.test(cells[0]) ? null : '%',
      rawValue: values.join(' | '),
    });
  }
  return result;
};

const parsePercentOrNumber = (value: string): number | null => {
  const normalized = value.replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};
