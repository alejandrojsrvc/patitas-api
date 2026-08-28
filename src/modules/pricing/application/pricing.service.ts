import { PricingPreconditionError } from '../domain/errors/pricing.error';
import { PricingCalculator } from '../domain/pricing-calculator';
import type { PricingRepository } from '../domain/repositories/pricing.repository';
import type {
  OperatingCostInput,
  PaymentFeeScheduleInput,
  PricingReview,
  PricingReviewSaveInput,
  PricingScenarioInput,
  PricingRuleValues,
} from '../domain/pricing.types';

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
    scenarioId?: string,
  ) {
    const [{ active }, context, allocation] = await Promise.all([
      this.repository.getRules(),
      this.repository.getContext(variantId, supplierOfferId),
      scenarioId
        ? this.repository.getPricingScenarioAllocation(scenarioId)
        : Promise.resolve(null),
    ]);
    if (!active)
      throw new PricingPreconditionError('No existe una configuración activa.');
    if (!context)
      throw new PricingPreconditionError(
        'La variante no tiene una oferta válida para calcular.',
      );
    const effectiveRules = {
      ...active,
      ...(allocation?.paymentFeeOverrides ?? {}),
      ...overrides,
    };
    return {
      context,
      rules: active,
      effectiveRules,
      scenario: allocation,
      calculation: this.calculator.calculate(context, effectiveRules, {
        fixedCostPerUnit: allocation?.fixedCostPerUnit,
      }),
    };
  }
  public async recalculate(
    variantId: string,
    supplierOfferId?: string,
    overrides: Partial<PricingRuleValues> = {},
    scenarioId?: string,
  ) {
    if (supplierOfferId) {
      await this.repository.setPreferredSupplierOffer(
        variantId,
        supplierOfferId,
      );
    }
    const result = await this.calculate(
      variantId,
      supplierOfferId,
      overrides,
      scenarioId,
    );
    return this.repository.saveReview(
      result.context,
      result.rules,
      result.effectiveRules,
      result.calculation,
    );
  }
  public async recalculateAll(scenarioId: string) {
    const [{ active }, allocation, contexts] = await Promise.all([
      this.repository.getRules(),
      this.repository.getPricingScenarioAllocation(scenarioId),
      this.repository.listContextsForBulkRecalculation(),
    ]);
    if (!active)
      throw new PricingPreconditionError('No existe una configuración activa.');

    const effectiveRules = {
      ...active,
      ...(allocation.paymentFeeOverrides ?? {}),
    };
    const inputs: PricingReviewSaveInput[] = contexts.map((context) => ({
      context,
      rules: active,
      effectiveRules,
      calculation: this.calculator.calculate(context, effectiveRules, {
        fixedCostPerUnit: allocation.fixedCostPerUnit,
      }),
    }));
    const reviews = await this.repository.saveReviews(inputs);

    return {
      scenarioId,
      processed: reviews.length,
      reviews: reviews.map((review) => ({
        variantId: review.variantId,
        pricingReviewId: review.id,
        recommendedPrice: review.recommendedPrice,
        commercialPrice: review.commercialPrice,
      })),
    };
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
  public async apply(
    variantId: string,
    reviewId: string,
    options?: { activateProduct?: boolean },
  ) {
    return this.repository.applyReview(variantId, reviewId, options);
  }
  public listPaymentFeeSchedules(active?: boolean) {
    return this.repository.listPaymentFeeSchedules(active);
  }
  public createPaymentFeeSchedule(input: PaymentFeeScheduleInput) {
    validatePaymentFeeSchedule(input);
    return this.repository.createPaymentFeeSchedule(input);
  }
  public updatePaymentFeeSchedule(
    id: string,
    input: Partial<PaymentFeeScheduleInput>,
  ) {
    validatePaymentFeeSchedule(input);
    return this.repository.updatePaymentFeeSchedule(id, input);
  }
  public async selectPaymentFeeSchedule(id: string) {
    const schedule = await this.repository.getPaymentFeeSchedule(id);
    if (!schedule) {
      throw new PricingPreconditionError('La tarifa de pago no existe.');
    }
    if (!schedule.active) {
      throw new PricingPreconditionError(
        'No se puede seleccionar una tarifa inactiva.',
      );
    }
    return this.repository.updateDraft({
      paymentFeeScheduleId: schedule.id,
      paymentFeePercent: schedule.feePercent,
      paymentFeeVatApplies: schedule.vatApplies,
      paymentFeeVatPercent: schedule.vatPercent,
      paymentFixedCost: schedule.fixedFee,
    });
  }
  public listOperatingCosts(active?: boolean) {
    return this.repository.listOperatingCosts(active);
  }
  public createOperatingCost(input: OperatingCostInput) {
    validateOperatingCost(input);
    return this.repository.createOperatingCost(input);
  }
  public updateOperatingCost(id: string, input: Partial<OperatingCostInput>) {
    validateOperatingCost(input);
    return this.repository.updateOperatingCost(id, input);
  }
  public listPricingScenarios() {
    return this.repository.listPricingScenarios();
  }
  public async createPricingScenario(input: PricingScenarioInput) {
    validatePricingScenario(input);
    await this.validateScenarioPaymentFee(input.paymentFeeScheduleId);
    return this.repository.createPricingScenario(input);
  }
  public async updatePricingScenario(
    id: string,
    input: Partial<PricingScenarioInput>,
  ) {
    validatePricingScenario(input);
    await this.validateScenarioPaymentFee(input.paymentFeeScheduleId);
    return this.repository.updatePricingScenario(id, input);
  }
  public analyzePricingScenario(id: string) {
    return this.repository.analyzePricingScenario(id);
  }

  private async validateScenarioPaymentFee(id: string | null | undefined) {
    if (!id) return;
    const schedule = await this.repository.getPaymentFeeSchedule(id);
    if (!schedule || !schedule.active) {
      throw new PricingPreconditionError(
        'El escenario debe usar una tarifa de pago activa.',
      );
    }
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
    'paymentFeeVatPercent',
    'taxPercent',
    'targetMarginPercent',
  ]);
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    if (key === 'paymentFeeScheduleId' || key === 'paymentFeeVatApplies') {
      continue;
    }
    if (typeof value !== 'string') continue;
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

const validatePaymentFeeSchedule = (
  input: Partial<PaymentFeeScheduleInput>,
): void => {
  if (input.settlementDays !== undefined && input.settlementDays < 0) {
    throw new PricingPreconditionError(
      'Los días de acreditación no pueden ser negativos.',
    );
  }
  for (const [key, value] of Object.entries(input)) {
    if (
      !['feePercent', 'vatPercent', 'fixedFee'].includes(key) ||
      value === undefined
    )
      continue;
    if (typeof value !== 'string' || !/^\d+(\.\d{1,2})?$/.test(value)) {
      throw new PricingPreconditionError(`Valor inválido para ${key}.`);
    }
    if (['feePercent', 'vatPercent'].includes(key) && Number(value) > 100) {
      throw new PricingPreconditionError(
        `El porcentaje ${key} no puede superar 100.`,
      );
    }
  }
};

const validateOperatingCost = (input: Partial<OperatingCostInput>): void => {
  if (input.amount !== undefined && input.amount !== null) {
    if (!/^\d+(\.\d{1,2})?$/.test(input.amount)) {
      throw new PricingPreconditionError('El importe del costo es inválido.');
    }
  }
  if (input.percent !== undefined && input.percent !== null) {
    if (
      !/^\d+(\.\d{1,2})?$/.test(input.percent) ||
      Number(input.percent) > 100
    ) {
      throw new PricingPreconditionError(
        'El porcentaje del costo es inválido.',
      );
    }
  }
};

const validatePricingScenario = (
  input: Partial<PricingScenarioInput>,
): void => {
  if (
    input.projectedOrders !== undefined &&
    (!Number.isInteger(input.projectedOrders) || input.projectedOrders < 0)
  ) {
    throw new PricingPreconditionError(
      'La cantidad proyectada de pedidos debe ser un entero no negativo.',
    );
  }
  if (input.averageItemsPerOrder !== undefined) {
    if (
      !/^\d+(\.\d{1,2})?$/.test(input.averageItemsPerOrder) ||
      Number(input.averageItemsPerOrder) <= 0
    ) {
      throw new PricingPreconditionError(
        'La media de productos por pedido debe ser mayor que cero.',
      );
    }
  }
  if (
    input.periodStart &&
    input.periodEnd &&
    input.periodEnd <= input.periodStart
  ) {
    throw new PricingPreconditionError(
      'El período debe finalizar después de comenzar.',
    );
  }
};
