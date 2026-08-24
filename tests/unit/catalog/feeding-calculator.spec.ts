import { calculateFoodDuration } from '../../../src/modules/catalog/domain/feeding-calculator';
import type { FeedingGuide } from '../../../src/modules/catalog/domain/catalog.types';

const guide: FeedingGuide = {
  id: 'guide-1',
  productId: 'product-1',
  sourceLabel: 'Tabla del fabricante',
  sourceUrl: 'https://example.com/feeding-guide',
  requiredDimensions: {},
  entries: [
    {
      petWeightKgMin: 10,
      petWeightKgMax: 10,
      lifeStage: 'adult',
      conditions: {},
      dailyGramsMin: 300,
      dailyGramsMax: 300,
    },
    {
      petWeightKgMin: 15,
      petWeightKgMax: 15,
      lifeStage: 'adult',
      conditions: {},
      dailyGramsMin: 450,
      dailyGramsMax: 450,
    },
  ],
};

describe('calculateFoodDuration', () => {
  it('uses and interpolates the manufacturer table inside its range', () => {
    const result = calculateFoodDuration(
      {
        petWeightKg: 12,
        presentationGrams: 15_000,
        lifeStage: 'adult',
        fallbackGramsPerKg: 18,
      },
      guide,
    );

    expect(result.source).toBe('MANUFACTURER');
    expect(result.dailyGrams).toEqual({ min: 360, max: 360 });
    expect(result.durationDays).toEqual({ min: 41.7, max: 41.7 });
  });

  it('does not extrapolate outside the manufacturer range', () => {
    const result = calculateFoodDuration(
      {
        petWeightKg: 20,
        presentationGrams: 15_000,
        lifeStage: 'adult',
        fallbackGramsPerKg: 18,
      },
      guide,
    );

    expect(result.source).toBe('GENERAL_FALLBACK');
    expect(result.isFallback).toBe(true);
    expect(result.dailyGrams).toEqual({ min: 360, max: 360 });
  });

  it('falls back when required manufacturer dimensions are missing', () => {
    const result = calculateFoodDuration(
      {
        petWeightKg: 12,
        presentationGrams: 15_000,
        lifeStage: 'adult',
        fallbackGramsPerKg: 18,
      },
      { ...guide, requiredDimensions: { activity: ['low', 'normal', 'high'] } },
    );

    expect(result.source).toBe('GENERAL_FALLBACK');
    expect(result.assumptions[0]).toContain('no cubre');
  });

  it('uses an open-ended manufacturer range without extrapolating', () => {
    const result = calculateFoodDuration(
      {
        petWeightKg: 60,
        presentationGrams: 20_000,
        lifeStage: 'adult',
        fallbackGramsPerKg: 18,
      },
      {
        ...guide,
        entries: [
          {
            petWeightKgMin: 51,
            petWeightKgMax: null,
            lifeStage: 'adult',
            conditions: {},
            dailyGramsMin: 560,
            dailyGramsMax: null,
          },
        ],
      },
    );

    expect(result.source).toBe('MANUFACTURER');
    expect(result.dailyGrams).toEqual({ min: 560, max: 560 });
  });
});
