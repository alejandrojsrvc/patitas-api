import { PricingPreconditionError } from '../domain/errors/pricing.error';
import { PricingCalculator } from '../domain/pricing-calculator';
import type { PricingRepository } from '../domain/repositories/pricing.repository';
import type { PricingReview, PricingRuleValues } from '../domain/pricing.types';

export class PricingService {
  public constructor(
    private readonly repository: PricingRepository,
    private readonly calculator: PricingCalculator,
  ) {}

  public getRules() {
    return this.repository.getRules();
  }
  public listRuleHistory() {
    return this.repository.listRuleHistory();
  }
  public updateDraft(input: Partial<PricingRuleValues>) {
    validateRuleValues(input);
    return this.repository.updateDraft(input);
  }
  public async activateDraft() {
    const { draft } = await this.repository.getRules();
    if (!draft)
      throw new PricingPreconditionError(
        'No existe una configuración borrador.',
      );
    this.calculator.calculate(dummyContext, draft);
    return this.repository.activateDraft();
  }
  public async calculate(
    variantId: string,
    supplierOfferId?: string,
    overrides: Partial<PricingRuleValues> = {},
  ) {
    const [{ active }, context] = await Promise.all([
      this.repository.getRules(),
      this.repository.getContext(variantId, supplierOfferId),
    ]);
    if (!active)
      throw new PricingPreconditionError('No existe una configuración activa.');
    if (!context)
      throw new PricingPreconditionError(
        'La variante no tiene una oferta válida para calcular.',
      );
    const effectiveRules = { ...active, ...overrides };
    return {
      context,
      rules: active,
      effectiveRules,
      calculation: this.calculator.calculate(context, effectiveRules),
    };
  }
  public async recalculate(
    variantId: string,
    overrides: Partial<PricingRuleValues> = {},
  ) {
    const result = await this.calculate(variantId, undefined, overrides);
    return this.repository.saveReview(
      result.context,
      result.rules,
      result.effectiveRules,
      result.calculation,
    );
  }
  public listReviews(variantId: string) {
    return this.repository.listReviews(variantId);
  }
  public listAllReviews(filter: {
    status?: PricingReview['status'];
    q?: string;
    page: number;
    perPage: number;
  }) {
    return this.repository.listAllReviews(filter);
  }
  public async apply(variantId: string, reviewId: string) {
    return this.repository.applyReview(variantId, reviewId);
  }
}

const dummyContext = {
  variantId: '',
  variantRevision: 0,
  currentSalePrice: null,
  supplierOfferId: '',
  supplierRevision: 0,
  supplierUnitCost: '0.00',
};

const validateRuleValues = (input: Partial<PricingRuleValues>): void => {
  const percentFields = new Set([
    'paymentFeePercent',
    'taxPercent',
    'targetMarginPercent',
  ]);
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    if (!/^\d+(\.\d{1,2})?$/.test(value)) {
      throw new PricingPreconditionError(`Valor inválido para ${key}.`);
    }
    if (percentFields.has(key) && Number(value) > 100) {
      throw new PricingPreconditionError(
        `El porcentaje ${key} no puede superar 100.`,
      );
    }
  }
};
