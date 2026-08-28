import { PricingCalculator } from '../../../src/modules/pricing/domain/pricing-calculator';
import type { PricingRules } from '../../../src/modules/pricing/domain/pricing.types';

describe('PricingCalculator', () => {
  it('identifies missing required configuration fields', () => {
    expect(() =>
      new PricingCalculator().calculate(
        {
          variantId: 'variant-id',
          variantRevision: 1,
          currentSalePrice: null,
          supplierOfferId: 'offer-id',
          supplierRevision: 1,
          supplierUnitCost: '10000.00',
        },
        {
          fulfillmentCost: null,
          packagingCost: '1500.00',
          paymentFixedCost: null,
          paymentFeePercent: '6.29',
          paymentFeeVatApplies: true,
          paymentFeeVatPercent: '21.00',
          paymentFeeScheduleId: 'schedule-id',
          subsidizedShippingCost: '3200.00',
          taxPercent: '0.00',
          otherCost: '0.00',
          targetMarginPercent: '30.00',
        },
      ),
    ).toThrow('Faltan: Fulfillment, costo fijo de pago.');
  });

  it('includes IVA on the Mercado Pago fee in the effective cost', () => {
    const result = new PricingCalculator().calculate(
      {
        variantId: 'variant-id',
        variantRevision: 1,
        currentSalePrice: null,
        supplierOfferId: 'offer-id',
        supplierRevision: 1,
        supplierUnitCost: '10000.00',
      },
      {
        fulfillmentCost: '0.00',
        packagingCost: '1500.00',
        paymentFixedCost: '0.00',
        paymentFeePercent: '6.29',
        paymentFeeVatApplies: true,
        paymentFeeVatPercent: '21.00',
        paymentFeeScheduleId: 'schedule-id',
        subsidizedShippingCost: '3200.00',
        taxPercent: '0.00',
        otherCost: '0.00',
        targetMarginPercent: '30.00',
      },
    );

    expect(result.breakdown.paymentVariable).toBe('1508.98');
    expect(result.breakdown.paymentFeeTax).toBe('316.89');
    expect(result.breakdown.subsidizedShipping).toBe('3200.00');
  });

  it('does not require persistence metadata such as activatedAt', () => {
    const rules: PricingRules = {
      id: 'rules-id',
      version: 1,
      status: 'ACTIVE',
      currency: 'ARS',
      fulfillmentCost: '0.00',
      packagingCost: '1500.00',
      paymentFixedCost: '0.00',
      paymentFeePercent: '6.29',
      paymentFeeVatApplies: null,
      paymentFeeVatPercent: null,
      paymentFeeScheduleId: null,
      subsidizedShippingCost: '3200.00',
      taxPercent: '0.00',
      otherCost: '0.00',
      targetMarginPercent: '30.00',
      createdAt: new Date(),
      activatedAt: null,
    };

    expect(() =>
      new PricingCalculator().calculate(
        {
          variantId: 'variant-id',
          variantRevision: 1,
          currentSalePrice: null,
          supplierOfferId: 'offer-id',
          supplierRevision: 1,
          supplierUnitCost: '10000.00',
        },
        rules,
      ),
    ).not.toThrow();
  });

  it('allows excluding IVA from the payment fee', () => {
    const result = new PricingCalculator().calculate(
      {
        variantId: 'variant-id',
        variantRevision: 1,
        currentSalePrice: null,
        supplierOfferId: 'offer-id',
        supplierRevision: 1,
        supplierUnitCost: '10000.00',
      },
      {
        fulfillmentCost: '0.00',
        packagingCost: '1500.00',
        paymentFixedCost: '0.00',
        paymentFeePercent: '6.29',
        paymentFeeVatApplies: false,
        paymentFeeVatPercent: '21.00',
        paymentFeeScheduleId: 'schedule-id',
        subsidizedShippingCost: '3200.00',
        taxPercent: '0.00',
        otherCost: '0.00',
        targetMarginPercent: '30.00',
      },
    );

    expect(result.breakdown.paymentFeeTax).toBe('0.00');
  });
});
