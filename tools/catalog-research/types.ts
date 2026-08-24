export type SourceKind = 'MANUFACTURER' | 'RETAILER';

export type ExtractionStatus = 'SUCCESS' | 'PARTIAL' | 'BLOCKED' | 'ERROR';

export type MatchStatus =
  'MATCHED' | 'MISMATCH' | 'MISSING' | 'AMBIGUOUS' | 'BLOCKED';

export interface CatalogResearchManifest {
  schemaVersion: 'catalog-research.v1';
  runId?: string;
  userAgent?: string;
  products: CatalogResearchProductInput[];
}

export interface CatalogBrandResearchManifest {
  schemaVersion: 'catalog-research.brand.v1';
  brand: string;
  categoryUrls: string[];
  productPathContains?: string[];
  userAgent?: string;
}

export interface CatalogResearchProductInput {
  canonicalKey: string;
  manufacturerUrl: string;
  expected: {
    brand: string;
    species: 'DOG' | 'CAT';
    line?: string;
    lifeStage?: string;
    breedSize?: string;
    recipe?: string;
    weightsGrams?: number[];
  };
  retailers: Partial<Record<RetailerCode, string>>;
}

export type RetailerCode = 'puppis' | 'mispichos' | 'pluspet' | 'natural-life';

export interface FieldProvenance {
  sourceUrl: string;
  method: 'HTML' | 'JSON_LD' | 'DOM' | 'BROWSER' | 'INFERRED';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface CompositionEntry {
  name: string;
  minimum: number | null;
  maximum: number | null;
  unit: string | null;
  rawValue: string;
}

export interface FeedingGuideEntry {
  petWeightKgMin: number;
  petWeightKgMax: number | null;
  lifeStage: string | null;
  conditions: Record<string, string>;
  dailyGramsMin: number;
  dailyGramsMax: number | null;
  rawWeight: string;
  rawDailyAmount: string;
}

export interface ExtractedImage {
  sourceUrl: string;
  altText: string;
  isPrimary: boolean;
}

export interface CanonicalProductExtraction {
  name: string | null;
  description: string | null;
  ingredientsText: string | null;
  analyticalComposition: CompositionEntry[];
  presentations: number[];
  feedingGuide: FeedingGuideEntry[];
  images: ExtractedImage[];
  attributes: {
    brand: string | null;
    species: string | null;
    line: string | null;
    lifeStage: string | null;
    breedSize: string | null;
    recipe: string | null;
  };
}

export interface RetailPriceObservation {
  retailer: RetailerCode;
  sourceUrl: string;
  externalProductId: string | null;
  externalVariantId: string | null;
  title: string | null;
  weightGrams: number | null;
  bonusWeightGrams: number | null;
  price: number | null;
  listPrice: number | null;
  currency: string;
  availability: 'AVAILABLE' | 'OUT_OF_STOCK' | 'UNKNOWN';
  priceCondition: string | null;
  matchStatus: MatchStatus;
  warnings: string[];
  observedAt: string;
  extractionMethod: FieldProvenance['method'];
}

export interface CatalogResearchProductResult {
  canonicalKey: string;
  expected: CatalogResearchProductInput['expected'];
  status: ExtractionStatus;
  source: {
    url: string;
    fetchedAt: string;
    contentHash: string;
    status: ExtractionStatus;
    warnings: string[];
  };
  product: CanonicalProductExtraction | null;
  provenance: Record<string, FieldProvenance>;
  retailObservations: RetailPriceObservation[];
  errors: string[];
}

export interface CatalogResearchRunResult {
  schemaVersion: 'catalog-research.v1';
  runId: string;
  extractorVersion: string;
  startedAt: string;
  completedAt: string;
  products: CatalogResearchProductResult[];
  warnings: string[];
  errors: string[];
}

export interface CatalogBrandProductJson {
  sourceUrl: string;
  name: string | null;
  presentations: number[];
  ingredients: string | null;
  analyticalComposition: CompositionEntry[];
  feedingGuide: Array<{
    condition: string | null;
    petWeightKgMin: number | null;
    petWeightKgMax: number | null;
    dailyGramsMin: number;
    dailyGramsMax: number | null;
  }>;
  image: string | null;
}

export interface CatalogBrandResearchResult {
  schemaVersion: 'catalog-research.brand-result.v1';
  runId: string;
  brand: string;
  products: CatalogBrandProductJson[];
  warnings: string[];
  errors: string[];
}
