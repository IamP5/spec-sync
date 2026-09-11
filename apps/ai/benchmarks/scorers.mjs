import { createScorer } from '@mastra/core/evals';

import {
  abstentionKey,
  claimKey,
  evidenceExists,
  predictionSchema,
  stable,
} from './contracts.mjs';

export const SCORER_VERSION = 'specsync-synthetic-contract-v1';

const ratio = (count, total, empty = 0) =>
  total === 0 ? empty : count / total;

function supports(entry, expected, sources) {
  if (!expected) return false;
  const accepted = new Set(expected.evidence.map(stable));
  const actual = new Set(entry.evidence.map(stable));
  return (
    accepted.size === actual.size &&
    entry.evidence.length > 0 &&
    entry.evidence.every(
      (evidence) =>
        evidenceExists(evidence, sources) && accepted.has(stable(evidence)),
    )
  );
}

export function assessPrediction(raw, gold, input) {
  const prediction = predictionSchema.parse(raw);
  const expectedClaims = new Map(
    gold.claims.map((claim) => [claimKey(claim), claim]),
  );
  const uniqueClaims = new Map();
  let duplicateClaims = 0;
  for (const claim of prediction.claims) {
    const key = claimKey(claim);
    if (uniqueClaims.has(key)) duplicateClaims += 1;
    else uniqueClaims.set(key, claim);
  }
  const correctClaims = [...uniqueClaims.entries()].filter(([key, claim]) =>
    supports(claim, expectedClaims.get(key), input.sources),
  );
  const expectedVariants = new Set(gold.variants.map(stable));
  const predictedVariants = new Set(prediction.variants.map(stable));
  const correctVariants = [...predictedVariants].filter((key) =>
    expectedVariants.has(key),
  );
  const expectedAbstentions = new Map(
    gold.abstentions.map((item) => [abstentionKey(item), item]),
  );
  const predictedAbstentions = new Map(
    prediction.abstentions.map((item) => [abstentionKey(item), item]),
  );
  const correctAbstentions = [...predictedAbstentions.entries()].filter(
    ([key, item]) =>
      supports(item, expectedAbstentions.get(key), input.sources),
  );
  const resolution = (value) =>
    stable({ ...value, vehicleIds: [...value.vehicleIds].sort() });
  const knownConfidence = [...uniqueClaims.entries()].filter(
    ([, claim]) => claim.confidence !== null,
  );
  const correctKeys = new Set(correctClaims.map(([key]) => key));
  const brier =
    knownConfidence.length === 0
      ? null
      : knownConfidence.reduce(
          (sum, [key, claim]) =>
            sum + (claim.confidence - (correctKeys.has(key) ? 1 : 0)) ** 2,
          0,
        ) / knownConfidence.length;
  const metrics = {
    identityAccuracy: Number(
      resolution(prediction.resolution) === resolution(gold.resolution),
    ),
    claimPrecision: ratio(
      correctClaims.length,
      uniqueClaims.size,
      expectedClaims.size === 0 ? 1 : 0,
    ),
    claimRecall: ratio(
      correctClaims.length,
      expectedClaims.size,
      uniqueClaims.size === 0 ? 1 : 0,
    ),
    variantPrecision: ratio(
      correctVariants.length,
      predictedVariants.size,
      expectedVariants.size === 0 ? 1 : 0,
    ),
    variantRecall: ratio(
      correctVariants.length,
      expectedVariants.size,
      predictedVariants.size === 0 ? 1 : 0,
    ),
    abstentionPrecision: ratio(
      correctAbstentions.length,
      predictedAbstentions.size,
      expectedAbstentions.size === 0 ? 1 : 0,
    ),
    abstentionRecall: ratio(
      correctAbstentions.length,
      expectedAbstentions.size,
      predictedAbstentions.size === 0 ? 1 : 0,
    ),
    evidenceValidity: ratio(
      correctClaims.length + correctAbstentions.length,
      uniqueClaims.size + predictedAbstentions.size,
      expectedClaims.size + expectedAbstentions.size === 0 ? 1 : 0,
    ),
    uniqueOutput: Number(
      duplicateClaims === 0 &&
        predictedVariants.size === prediction.variants.length &&
        new Set(prediction.variants.map((vehicle) => vehicle.id)).size ===
          prediction.variants.length &&
        predictedAbstentions.size === prediction.abstentions.length,
    ),
  };
  return {
    metrics,
    counts: {
      expectedClaims: expectedClaims.size,
      predictedClaims: uniqueClaims.size,
      correctClaims: correctClaims.length,
      unsupportedOrIncorrectClaims: uniqueClaims.size - correctClaims.length,
      duplicateClaims,
      expectedVariants: expectedVariants.size,
      correctVariants: correctVariants.length,
    },
    confidence: {
      coverage: ratio(knownConfidence.length, uniqueClaims.size),
      brierScore: brier,
      calibrated: false,
    },
    failures: Object.entries(metrics)
      .filter(([, score]) => score !== 1)
      .map(([name]) => name),
  };
}

const metricNames = [
  'identityAccuracy',
  'claimPrecision',
  'claimRecall',
  'variantPrecision',
  'variantRecall',
  'abstentionPrecision',
  'abstentionRecall',
  'evidenceValidity',
  'uniqueOutput',
];

export const scorers = metricNames.map((metric) =>
  createScorer({
    id: `specsync-${metric}`,
    description: `Synthetic contract gate: ${metric}; exact evidence-backed matching, version ${SCORER_VERSION}`,
  }).generateScore(({ run }) => {
    const score = run.output.metrics[metric];
    if (!Number.isFinite(score) || score < 0 || score > 1)
      throw new Error(`Invalid ${metric} score`);
    return score;
  }),
);

export async function scorePrediction(prediction, gold, input) {
  const assessment = assessPrediction(prediction, gold, input);
  const scores = {};
  for (const scorer of scorers) {
    const result = await scorer.run({ output: assessment });
    scores[scorer.id] = result.score;
  }
  return {
    ...assessment,
    scores,
    passed: Object.values(scores).every((score) => score === 1),
  };
}
