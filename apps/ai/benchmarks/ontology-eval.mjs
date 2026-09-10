import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createScorer } from '@mastra/core/evals';
import { build } from 'esbuild';
import { z } from 'zod';

import { digest, stable } from './contracts.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
export const ontologyDatasetPath = fileURLToPath(
  new URL('./fixtures/ontology-synthetic-br-v1.json', import.meta.url),
);
const observationSchema = z.object({
  originalTerm: z.string(),
  rawValue: z.string(),
  sourceUnit: z.string().nullable(),
  qualifiers: z.array(z.object({ name: z.string(), value: z.string() })),
  lineStart: z.number().int().positive(),
  lineEnd: z.number().int().positive(),
  locator: z.string(),
  proposal: z.null(),
});
const termSchema = z.object({
  attributeCode: z.string(),
  term: z.string(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  market: z.string().nullable(),
  language: z.string().nullable(),
  modelYear: z.number().int().nullable(),
});
const datasetSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  revision: z.string(),
  synthetic: z.literal(true),
  provenance: z.literal('synthetic'),
  description: z.string(),
  terminologyBefore: z.array(termSchema).max(100),
  terminologyAfter: z.array(termSchema).max(100),
  cases: z
    .array(
      z.object({
        id: z.string(),
        configuration: z.string(),
        text: z.string().max(10000),
        sourceSha256: z.string(),
        scope: z.object({
          brand: z.string(),
          model: z.string(),
          market: z.string(),
          modelYear: z.number().int(),
        }),
        observation: observationSchema,
        gold: z.object({
          beforeAttributeCode: z.string().nullable(),
          afterAttributeCode: z.string().nullable(),
          configuration: z.string(),
          originalTerm: z.string(),
          rawValue: z.string(),
          sourceUnit: z.string().nullable(),
          qualifiers: z.record(z.string()),
          lineStart: z.number().int(),
          lineEnd: z.number().int(),
          excerpt: z.string(),
        }),
      }),
    )
    .min(1)
    .max(100),
});

export async function loadOntologyDataset(path = ontologyDatasetPath) {
  const dataset = datasetSchema.parse(JSON.parse(await readFile(path, 'utf8')));
  if (new Set(dataset.cases.map(({ id }) => id)).size !== dataset.cases.length)
    throw new Error('Duplicate ontology case id');
  for (const item of dataset.cases) {
    if (digest(item.text) !== item.sourceSha256)
      throw new Error(`Source digest mismatch: ${item.id}`);
    if (
      item.text
        .split('\n')
        .slice(item.gold.lineStart - 1, item.gold.lineEnd)
        .join('\n') !== item.gold.excerpt
    )
      throw new Error(`Invalid ontology gold evidence: ${item.id}`);
  }
  return dataset;
}

/** Bundle the production TypeScript functions; fixtures never carry a reimplementation. */
export async function loadOntologyRuntime() {
  const cache = resolve(root, 'node_modules/.cache');
  await mkdir(cache, { recursive: true });
  const directory = await mkdtemp(resolve(cache, 'ontology-eval-'));
  const outfile = resolve(directory, 'runtime.mjs');
  try {
    const result = await build({
      absWorkingDir: root,
      stdin: {
        contents: `export { resolveTerm } from './apps/ai/src/mastra/ingestion/ontology.ts';\nexport { verifyUnmappedObservations } from './apps/ai/src/mastra/ingestion/extraction.ts';`,
        resolveDir: root,
      },
      bundle: true,
      packages: 'external',
      platform: 'node',
      format: 'esm',
      outfile,
      metafile: true,
    });
    const hashes = {};
    for (const path of Object.keys(result.metafile.inputs).filter(
      (path) => path !== '<stdin>',
    ))
      hashes[path] = digest(await readFile(resolve(root, path)));
    return {
      runtime: await import(pathToFileURL(outfile).href),
      sourceHashes: hashes,
      close: () => rm(directory, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export function predictOntology(dataset, runtime) {
  return dataset.cases.map((item) => {
    if (digest(item.text) !== item.sourceSha256)
      throw new Error(`Source digest mismatch: ${item.id}`);
    const checked = runtime.verifyUnmappedObservations(
      { text: item.text, readerRevision: 'synthetic-text-v1' },
      [item.observation],
    );
    const observation = checked.observations[0];
    return {
      id: item.id,
      beforeAttributeCode: observation
        ? (runtime.resolveTerm(
            observation.originalTerm,
            item.scope,
            dataset.terminologyBefore,
          ) ?? null)
        : null,
      afterAttributeCode: observation
        ? (runtime.resolveTerm(
            observation.originalTerm,
            item.scope,
            dataset.terminologyAfter,
          ) ?? null)
        : null,
      observation: observation
        ? { ...observation, configuration: item.configuration }
        : null,
    };
  });
}

const ratio = (count, total) => (total ? count / total : 1);
export function assessOntology(predictions, dataset) {
  const byId = new Map(predictions.map((item) => [item.id, item]));
  let falseMerges = 0,
    correctMappings = 0,
    expectedMappings = 0,
    retainedNovel = 0,
    expectedNovel = 0;
  let validEvidence = 0,
    correctBinding = 0,
    correctQualifiers = 0,
    correctBefore = 0,
    correctAfter = 0;
  let expectedBefore = 0,
    expectedAfter = 0;
  for (const item of dataset.cases) {
    const actual = byId.get(item.id);
    const expected = item.gold;
    for (const stage of ['beforeAttributeCode', 'afterAttributeCode']) {
      if (actual?.[stage] != null && actual[stage] !== expected[stage])
        falseMerges++;
      if (expected[stage] !== null) {
        expectedMappings++;
        if (actual?.[stage] === expected[stage]) correctMappings++;
      }
    }
    if (expected.beforeAttributeCode !== null) expectedBefore++;
    if (expected.afterAttributeCode !== null) expectedAfter++;
    if (
      expected.beforeAttributeCode !== null &&
      actual?.beforeAttributeCode === expected.beforeAttributeCode
    )
      correctBefore++;
    if (
      expected.afterAttributeCode !== null &&
      actual?.afterAttributeCode === expected.afterAttributeCode
    )
      correctAfter++;
    if (expected.afterAttributeCode === null) {
      expectedNovel++;
      if (actual?.observation && actual.afterAttributeCode === null)
        retainedNovel++;
    }
    const observed = actual?.observation;
    if (!observed) continue;
    if (
      observed.lineStart === expected.lineStart &&
      observed.lineEnd === expected.lineEnd &&
      observed.excerpt === expected.excerpt &&
      digest(item.text) === item.sourceSha256
    )
      validEvidence++;
    if (
      ['configuration', 'originalTerm', 'rawValue', 'sourceUnit'].every(
        (field) => observed[field] === expected[field],
      )
    )
      correctBinding++;
    if (stable(observed.qualifiers) === stable(expected.qualifiers))
      correctQualifiers++;
  }
  const count = dataset.cases.length;
  const metrics = {
    zeroFalseMerges: Number(falseMerges === 0),
    knownMappingRecall: ratio(correctMappings, expectedMappings),
    novelConceptRetention: ratio(retainedNovel, expectedNovel),
    evidenceValidity: ratio(validEvidence, count),
    configurationValueAccuracy: ratio(correctBinding, count),
    qualifierAccuracy: ratio(correctQualifiers, count),
    coverageGain: Number(
      correctAfter - correctBefore === expectedAfter - expectedBefore &&
        correctAfter === expectedAfter,
    ),
    uniqueCompleteCases: Number(
      predictions.length === count &&
        byId.size === count &&
        dataset.cases.every(({ id }) => byId.has(id)),
    ),
  };
  return {
    metrics,
    counts: {
      falseMerges,
      expectedMappings,
      correctMappings,
      expectedNovel,
      retainedNovel,
      correctBefore,
      correctAfter,
      expectedBefore,
      expectedAfter,
      coverageGain: correctAfter - correctBefore,
    },
  };
}

export async function scoreOntology(predictions, dataset) {
  const assessment = assessOntology(predictions, dataset);
  const scores = {};
  for (const metric of Object.keys(assessment.metrics)) {
    const scorer = createScorer({
      id: `ontology-${metric}`,
      description: `Synthetic ontology contract gate: ${metric}`,
    }).generateScore(({ run }) => run.output.metrics[metric]);
    scores[metric] = (await scorer.run({ output: assessment })).score;
  }
  return {
    ...assessment,
    scores,
    passed: Object.values(scores).every((score) => score === 1),
  };
}

export async function runOntologyBenchmark() {
  const dataset = await loadOntologyDataset();
  const loaded = await loadOntologyRuntime();
  try {
    const predictions = predictOntology(dataset, loaded.runtime);
    return {
      schemaVersion: 1,
      datasetId: dataset.id,
      datasetRevision: dataset.revision,
      datasetSha256: digest(stable(dataset)),
      sourceHashes: loaded.sourceHashes,
      synthetic: true,
      provenance: 'synthetic',
      modelCalls: 0,
      costUsd: 0,
      limitations:
        'Pre-extracted fabricated observations test production deterministic mapping and evidence contracts. This does not measure model extraction, PDF reading, API activation or calibration accuracy.',
      ...(await scoreOntology(predictions, dataset)),
      predictions,
    };
  } finally {
    await loaded.close();
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const report = await runOntologyBenchmark();
  const path = resolve(root, 'dist/benchmarks/ontology-synthetic-br-v1.json');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    `${report.passed ? 'PASS' : 'FAIL'} ontology synthetic contract; false merges=${report.counts.falseMerges}, coverage gain=${report.counts.coverageGain}; ${path}`,
  );
  process.exitCode = report.passed ? 0 : 1;
}
