import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/infrastructure/database/generated/prisma/client';
import { loadProjectEnv } from './load-project-env';
import { PricingService } from '../src/modules/pricing/application/pricing.service';
import { PricingCalculator } from '../src/modules/pricing/domain/pricing-calculator';
import { PricingScenarioCalculator } from '../src/modules/pricing/domain/pricing-scenario-calculator';
import { PrismaPricingRepository } from '../src/modules/pricing/infrastructure/persistence/prisma-pricing.repository';
import type { PrismaService } from '../src/infrastructure/database/prisma.service';

loadProjectEnv();

const scenarioArgument = process.argv.find((value) =>
  value.startsWith('--scenario-id='),
);
const scenarioId = scenarioArgument?.slice('--scenario-id='.length);
const apply = process.argv.includes('--apply');
const publish = process.argv.includes('--publish');
const connectionString = process.env.PRODUCTION_DATABASE_URL;

if (!scenarioId) {
  throw new Error(
    'Uso: pnpm pricing:apply-all -- --scenario-id=<uuid> [--apply] [--publish].',
  );
}

if (!connectionString) {
  throw new Error(
    'Se requiere PRODUCTION_DATABASE_URL. PRODUCTION_SUPABASE_URL y PRODUCTION_SUPABASE_SECRET_KEY no son una conexión PostgreSQL.',
  );
}

if (
  connectionString.includes('127.0.0.1') ||
  connectionString.includes('localhost')
) {
  throw new Error('PRODUCTION_DATABASE_URL no puede apuntar a localhost.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const repository = new PrismaPricingRepository(
  prisma as unknown as PrismaService,
  new PricingScenarioCalculator(),
);
const pricing = new PricingService(repository, new PricingCalculator());

const main = async (): Promise<void> => {
  const rules = await repository.getRules();
  if (!rules.active)
    throw new Error('No existe una configuración de pricing activa.');

  const allocation = await repository.getPricingScenarioAllocation(scenarioId);
  const contexts = await repository.listContextsForBulkRecalculation();
  const effectiveRules = {
    ...rules.active,
    ...(allocation.paymentFeeOverrides ?? {}),
  };
  const calculator = new PricingCalculator();
  const preview = contexts.map((context) => {
    const calculation = calculator.calculate(context, effectiveRules, {
      fixedCostPerUnit: allocation.fixedCostPerUnit,
    });
    return {
      variantId: context.variantId,
      supplierOfferId: context.supplierOfferId,
      currentSalePrice: context.currentSalePrice,
      recommendedPrice: calculation.recommendedPrice,
      commercialPrice: calculation.commercialPrice,
    };
  });

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          scenarioId,
          rulesVersion: rules.active.version,
          fixedCostPerUnit: allocation.fixedCostPerUnit,
          processed: preview.length,
          preview,
        },
        null,
        2,
      ),
    );
    return;
  }

  const recalculated = await pricing.recalculateAll(scenarioId);
  const variantIds = recalculated.reviews.map((review) => review.variantId);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true,
      sku: true,
      productId: true,
      product: {
        select: {
          id: true,
          name: true,
          status: true,
          categoryId: true,
          brand: { select: { active: true } },
          category: { select: { active: true } },
          media: { select: { url: true }, take: 1 },
          variants: { select: { active: true, sku: true, salePrice: true } },
        },
      },
    },
  });
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));
  const productCanBeActivated = new Map<string, boolean>();
  for (const variant of variants) {
    const product = variant.product;
    const sellable = product.variants.some(
      (item) =>
        item.active && Boolean(item.sku) && Number(item.salePrice ?? 0) > 0,
    );
    productCanBeActivated.set(
      product.id,
      Boolean(
        product.categoryId &&
        product.category?.active &&
        product.brand.active &&
        product.media.some((item) => item.url.trim()) &&
        sellable,
      ),
    );
  }

  const applied: Array<Record<string, unknown>> = [];
  const notActivated: Array<Record<string, unknown>> = [];
  for (const review of recalculated.reviews) {
    const variant = variantById.get(review.variantId);
    if (!variant)
      throw new Error(`No se encontró la variante ${review.variantId}.`);
    const activateProduct =
      publish && productCanBeActivated.get(variant.productId) === true;
    await pricing.apply(review.variantId, review.pricingReviewId, {
      activateProduct,
    });
    const result = {
      sku: variant.sku,
      variantId: review.variantId,
      productId: variant.productId,
      commercialPrice: review.commercialPrice,
      activateProduct,
    };
    applied.push(result);
    if (publish && !activateProduct) notActivated.push(result);
  }

  console.log(
    JSON.stringify(
      {
        mode: 'apply',
        scenarioId,
        rulesVersion: rules.active.version,
        fixedCostPerUnit: allocation.fixedCostPerUnit,
        recalculated: recalculated.processed,
        applied: applied.length,
        activatedVariants: applied.filter((item) => item.activateProduct)
          .length,
        notActivated,
      },
      null,
      2,
    ),
  );
};

try {
  await main();
} finally {
  await prisma.$disconnect();
}
