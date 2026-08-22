import { PricingPreconditionError } from './errors/pricing.error';
import type {
  PricingCalculation, PricingContext, PricingRuleValues,
} from './pricing.types';

export class PricingCalculator {
  public calculate(context: PricingContext, rules: PricingRuleValues): PricingCalculation {
    assertComplete(rules);
    const product = Money.parse(context.supplierUnitCost);
    const fulfillment = Money.parse(rules.fulfillmentCost);
    const packaging = Money.parse(rules.packagingCost);
    const paymentFixed = Money.parse(rules.paymentFixedCost);
    const shipping = Money.parse(rules.subsidizedShippingCost);
    const other = Money.parse(rules.otherCost);
    const paymentRate = percentToBasisPoints(rules.paymentFeePercent);
    const taxRate = percentToBasisPoints(rules.taxPercent);
    const targetMargin = percentToBasisPoints(rules.targetMarginPercent);
    const totalRate = paymentRate + taxRate + targetMargin;
    if (totalRate >= 10_000) {
      throw new PricingPreconditionError(
        'La suma de tasas variables y margen debe ser menor que 100%.',
      );
    }

    const fixed = [product, fulfillment, packaging, paymentFixed, shipping, other]
      .reduce((sum, value) => sum.add(value), Money.zero());
    const recommended = Money.fromCents(
      divideCeil(fixed.cents * 10_000n, BigInt(10_000 - totalRate)),
    );
    const commercial = recommended.nextPriceEnding990();
    const paymentVariable = commercial.percent(paymentRate);
    const taxes = commercial.percent(taxRate);
    const effective = fixed.add(paymentVariable).add(taxes);
    const profit = commercial.subtract(effective);
    const resultingMargin = commercial.cents === 0n
      ? 0
      : Number((profit.cents * 1_000_000n) / commercial.cents) / 10_000;

    return {
      recommendedPrice: recommended.toString(),
      commercialPrice: commercial.toString(),
      breakdown: {
        productCost: product.toString(), fulfillment: fulfillment.toString(),
        packaging: packaging.toString(), paymentFixed: paymentFixed.toString(),
        paymentVariable: paymentVariable.toString(), subsidizedShipping: shipping.toString(),
        taxes: taxes.toString(), other: other.toString(), effectiveCost: effective.toString(),
        estimatedProfit: profit.toString(), resultingMarginPercent: resultingMargin.toFixed(2),
      },
    };
  }
}

class Money {
  private constructor(public readonly cents: bigint) {}
  public static zero() { return new Money(0n); }
  public static fromCents(cents: bigint) { return new Money(cents); }
  public static parse(value: string): Money {
    if (!/^\d+(\.\d{1,2})?$/.test(value)) {
      throw new PricingPreconditionError(`Importe monetario inválido: ${value}.`);
    }
    const [whole, fraction = ''] = value.split('.');
    return new Money(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')));
  }
  public add(other: Money) { return new Money(this.cents + other.cents); }
  public subtract(other: Money) { return new Money(this.cents - other.cents); }
  public percent(basisPoints: number) {
    return new Money(divideCeil(this.cents * BigInt(basisPoints), 10_000n));
  }
  public nextPriceEnding990() {
    const wholePesos = divideCeil(this.cents, 100n);
    let candidate = (wholePesos / 1_000n) * 1_000n + 990n;
    if (candidate < wholePesos) candidate += 1_000n;
    return new Money(candidate * 100n);
  }
  public toString() {
    const absolute = this.cents < 0n ? -this.cents : this.cents;
    const sign = this.cents < 0n ? '-' : '';
    return `${sign}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`;
  }
}

const divideCeil = (numerator: bigint, denominator: bigint) =>
  (numerator + denominator - 1n) / denominator;

const percentToBasisPoints = (value: string): number => {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    throw new PricingPreconditionError(`Porcentaje inválido: ${value}.`);
  }
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
};

function assertComplete(rules: PricingRuleValues): asserts rules is {
  [K in keyof PricingRuleValues]: string;
} {
  if (Object.values(rules).some((value) => value === null)) {
    throw new PricingPreconditionError(
      'La configuración de pricing debe estar completa antes de calcular.',
    );
  }
}
