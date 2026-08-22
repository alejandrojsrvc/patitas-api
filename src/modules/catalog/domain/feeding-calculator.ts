import type { FeedingGuide, FeedingGuideEntry } from './catalog.types';

export type FeedingEstimateSource = 'MANUFACTURER' | 'GENERAL_FALLBACK';

export interface FeedingCalculationInput {
  petWeightKg: number;
  presentationGrams: number;
  lifeStage?: string;
  attributes?: Record<string, string>;
  fallbackGramsPerKg: number;
}

export interface FeedingCalculationResult {
  source: FeedingEstimateSource;
  sourceLabel: string;
  sourceUrl: string | null;
  isFallback: boolean;
  dailyGrams: { min: number; max: number };
  durationDays: { min: number; max: number };
  assumptions: string[];
}

export const calculateFoodDuration = (
  input: FeedingCalculationInput,
  guide: FeedingGuide | null,
): FeedingCalculationResult => {
  assertPositive(input.petWeightKg, 'El peso de la mascota');
  assertPositive(input.presentationGrams, 'La presentación');
  assertPositive(input.fallbackGramsPerKg, 'El factor general');

  const manufacturer = guide ? resolveManufacturerEntry(input, guide) : null;
  if (manufacturer) {
    return buildResult({
      source: 'MANUFACTURER',
      sourceLabel: guide!.sourceLabel,
      sourceUrl: guide!.sourceUrl,
      min: manufacturer.dailyGramsMin,
      max: manufacturer.dailyGramsMax,
      presentationGrams: input.presentationGrams,
      assumptions: [
        'Estimación basada en la tabla de raciones declarada por el fabricante.',
      ],
    });
  }

  const stageMultiplier =
    fallbackStageMultiplier[input.lifeStage ?? 'adult'] ?? 1;
  const daily = input.petWeightKg * input.fallbackGramsPerKg * stageMultiplier;
  return buildResult({
    source: 'GENERAL_FALLBACK',
    sourceLabel: 'Estimación general de Patitas',
    sourceUrl: null,
    min: daily,
    max: daily,
    presentationGrams: input.presentationGrams,
    assumptions: [
      guide
        ? 'La tabla del fabricante no cubre todos los datos ingresados.'
        : 'Este producto todavía no tiene una tabla del fabricante cargada.',
      'El resultado es orientativo y puede variar según actividad, condición corporal y recomendación veterinaria.',
    ],
  });
};

const resolveManufacturerEntry = (
  input: FeedingCalculationInput,
  guide: FeedingGuide,
): FeedingGuideEntry | null => {
  if (!hasRequiredDimensions(input.attributes ?? {}, guide.requiredDimensions))
    return null;
  const entries = guide.entries
    .filter((entry) => !entry.lifeStage || entry.lifeStage === input.lifeStage)
    .filter((entry) =>
      conditionsMatch(entry.conditions, input.attributes ?? {}),
    )
    .sort((left, right) => left.petWeightKg - right.petWeightKg);
  if (entries.length === 0) return null;

  const exact = entries.find(
    (entry) => entry.petWeightKg === input.petWeightKg,
  );
  if (exact) return exact;
  const lower = [...entries]
    .reverse()
    .find((entry) => entry.petWeightKg < input.petWeightKg);
  const upper = entries.find((entry) => entry.petWeightKg > input.petWeightKg);
  if (!lower || !upper) return null;

  const ratio =
    (input.petWeightKg - lower.petWeightKg) /
    (upper.petWeightKg - lower.petWeightKg);
  return {
    ...lower,
    petWeightKg: input.petWeightKg,
    dailyGramsMin: interpolate(lower.dailyGramsMin, upper.dailyGramsMin, ratio),
    dailyGramsMax: interpolate(lower.dailyGramsMax, upper.dailyGramsMax, ratio),
  };
};

const buildResult = (input: {
  source: FeedingEstimateSource;
  sourceLabel: string;
  sourceUrl: string | null;
  min: number;
  max: number;
  presentationGrams: number;
  assumptions: string[];
}): FeedingCalculationResult => ({
  source: input.source,
  sourceLabel: input.sourceLabel,
  sourceUrl: input.sourceUrl,
  isFallback: input.source === 'GENERAL_FALLBACK',
  dailyGrams: { min: round(input.min), max: round(input.max) },
  durationDays: {
    min: round(input.presentationGrams / input.max),
    max: round(input.presentationGrams / input.min),
  },
  assumptions: input.assumptions,
});

const hasRequiredDimensions = (
  values: Record<string, string>,
  dimensions: Record<string, string[]>,
) =>
  Object.entries(dimensions).every(
    ([key, allowed]) =>
      typeof values[key] === 'string' &&
      (allowed.length === 0 || allowed.includes(values[key])),
  );

const conditionsMatch = (
  conditions: Record<string, string>,
  values: Record<string, string>,
) => Object.entries(conditions).every(([key, value]) => values[key] === value);

const interpolate = (start: number, end: number, ratio: number) =>
  start + (end - start) * ratio;
const round = (value: number) => Math.round(value * 10) / 10;
const assertPositive = (value: number, label: string) => {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`${label} debe ser mayor a cero.`);
};
const fallbackStageMultiplier: Record<string, number> = {
  puppy: 1.3,
  kitten: 1.3,
  adult: 1,
  senior: 0.9,
};
