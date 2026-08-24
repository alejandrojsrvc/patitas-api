import {
  extractManufacturer,
  extractRetailObservation,
} from '../../../tools/catalog-research/adapters';
import {
  normalizeMoney,
  normalizeWeightGrams,
} from '../../../tools/catalog-research/normalizers';
import type { CatalogResearchProductInput } from '../../../tools/catalog-research/types';

const input: CatalogResearchProductInput = {
  canonicalKey: 'old-prince-premium-adulto-perro',
  manufacturerUrl: 'https://oldprince.example/product',
  expected: {
    brand: 'Old Prince',
    species: 'DOG',
    weightsGrams: [3000, 20000],
  },
  retailers: {},
};

describe('catalog research extraction', () => {
  it('normalizes Argentine money and package weights', () => {
    expect(normalizeMoney('$ 62.800')).toBe(62800);
    expect(normalizeMoney('$ 60.911,50')).toBe(60911.5);
    expect(normalizeWeightGrams('20 Kg')).toBe(20000);
    expect(normalizeWeightGrams('500 g')).toBe(500);
  });

  it('extracts ingredients, tables, composition and images from the manufacturer HTML', () => {
    const page = {
      url: input.manufacturerUrl,
      fetchedAt: '2026-08-23T12:00:00.000Z',
      contentHash: 'hash',
      method: 'HTML' as const,
      html: `
        <h2>Old Prince Premium Adultos</h2>
        <h2>Ingredientes</h2>
        <p>Harina de pollo, arroz y aceite de pescado.</p>
        <h2>Cantidad diaria recomendada</h2>
        <table><tr><th>Peso</th><th>Gramos de alimento</th></tr>
          <tr><td>2 - 5 kg.</td><td>60 - 120 g.</td></tr>
          <tr><td>51 kg. o más</td><td>560 g o más</td></tr>
        </table>
        <h2>Composicion centesimal</h2>
        <table><tr><th>Ingredientes</th><th>Minimo</th><th>Máximo</th></tr>
          <tr><td>Proteína</td><td>23 %</td><td></td></tr>
        </table>
        <img src="https://cdn.example/old-prince.png" />
      `,
    };

    const result = extractManufacturer(page);

    expect(result.product.ingredientsText).toContain('Harina de pollo');
    expect(result.product.feedingGuide).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          petWeightKgMin: 2,
          petWeightKgMax: 5,
          dailyGramsMax: 120,
        }),
        expect.objectContaining({
          petWeightKgMin: 51,
          petWeightKgMax: null,
          dailyGramsMax: null,
        }),
      ]),
    );
    expect(result.product.analyticalComposition).toEqual([
      expect.objectContaining({ name: 'Proteína', minimum: 23 }),
    ]);
    expect(result.product.images[0]?.sourceUrl).toBe(
      'https://cdn.example/old-prince.png',
    );
  });

  it('marks a retailer with a different brand as a mismatch', () => {
    const page = {
      url: 'https://retail.example/product',
      fetchedAt: '2026-08-23T12:00:00.000Z',
      contentHash: 'hash',
      method: 'HTML' as const,
      html: '<h1>Excellent Adulto Perro 20 Kg</h1><span>$ 62.800</span>',
    };

    const result = extractRetailObservation(page, 'puppis', input);

    expect(result.matchStatus).toBe('MISMATCH');
    expect(result.price).toBe(62800);
  });
});
