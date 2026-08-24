import type {
  CompetitivePriceAverage,
  CompetitivePriceObservation,
} from './catalog.types';

export const calculateCompetitivePriceAverage = (
  observations: CompetitivePriceObservation[],
  expectedRetailerCount = 4,
): CompetitivePriceAverage => {
  const latestByRetailer = new Map<string, CompetitivePriceObservation>();
  for (const observation of observations) {
    const current = latestByRetailer.get(observation.retailerCode);
    if (!current || observation.observedAt > current.observedAt) {
      latestByRetailer.set(observation.retailerCode, observation);
    }
  }
  const retailers = [...latestByRetailer.values()]
    .sort((left, right) => left.retailerCode.localeCompare(right.retailerCode))
    .map((observation) => ({
      retailerCode: observation.retailerCode,
      price: observation.price,
      observedAt: observation.observedAt,
      sourceUrl: observation.sourceUrl,
    }));
  const valid = [...latestByRetailer.values()].filter(
    (observation) =>
      observation.matchStatus === 'MATCHED' &&
      observation.availability === 'AVAILABLE' &&
      observation.price !== null &&
      Number(observation.price) > 0,
  );
  const currency = valid[0]?.currency ?? observations[0]?.currency ?? 'ARS';
  const average = valid.length
    ? valid.reduce(
        (total, observation) => total + Number(observation.price),
        0,
      ) / valid.length
    : null;
  return {
    currency,
    averagePrice: average === null ? null : average.toFixed(2),
    sampleCount: valid.length,
    expectedRetailerCount,
    retailers,
  };
};
