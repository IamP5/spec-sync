import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { test } from 'node:test';

import {
  deterministicCandidate,
  openrouterCandidate,
  replayCandidate,
} from './candidates.mjs';
import { digest, predictionSchema, validateDataset } from './contracts.mjs';
import { defaultDatasetPath, main, parseArgs, runBenchmark } from './run.mjs';
import { assessPrediction, scorePrediction } from './scorers.mjs';

const dataset = validateDataset(
  JSON.parse(await readFile(defaultDatasetPath, 'utf8')),
);
const pickup = dataset.cases[0];
const predictionOf = (item) =>
  predictionSchema.parse(structuredClone(item.gold));
const assess = (prediction) =>
  assessPrediction(prediction, pickup.gold, pickup.input);

test('all source-only baseline cases pass core scorers, including ambiguity and empty/unknown sources', async () => {
  const report = await runBenchmark(dataset, deterministicCandidate());
  assert.equal(report.passed, true);
  assert.equal(report.summary.totalTrials, dataset.cases.length);
  assert.equal(report.summary.costUsd, 0);
  assert.equal(report.scope, 'synthetic-contract-only');
  assert.equal(report.trials[0].confidence.brierScore, null);
  assert.equal(
    report.trials.find((item) => item.caseId === 'suv-year-ambiguity')
      .prediction.resolution.status,
    'needs-clarification',
  );
});

test('candidate receives only a cloned source input and no ground truth', async () => {
  const baseline = deterministicCandidate();
  const candidate = {
    ...baseline,
    async run(input, context) {
      assert.deepEqual(Object.keys(input).sort(), [
        'query',
        'requested',
        'sources',
      ]);
      assert.equal('gold' in context, false);
      assert.notEqual(input, pickup.input);
      const result = await baseline.run(input, context);
      input.sources[0].text = 'candidate mutation';
      return result;
    },
  };
  const report = await runBenchmark({ ...dataset, cases: [pickup] }, candidate);
  assert.equal(report.passed, true);
  assert.notEqual(pickup.input.sources[0].text, 'candidate mutation');
});

for (const [name, mutate] of [
  [
    'wrong trim',
    (p) => {
      p.claims[0].vehicleId = p.variants[1].id;
    },
  ],
  [
    'wrong unit',
    (p) => {
      p.claims[0].unit = 'cv';
    },
  ],
  [
    'missing fuel qualifier',
    (p) => {
      p.claims[0].qualifiers = {};
    },
  ],
  [
    'optional presented as standard',
    (p) => {
      p.claims.find((c) => c.availability === 'optional').availability =
        'standard';
    },
  ],
  [
    'wrong source revision',
    (p) => {
      p.claims[0].evidence[0].revision = 'forged';
    },
  ],
  [
    'wrong column with a quote containing both values',
    (p) => {
      p.claims[0].evidence[0].column = 2;
    },
  ],
  [
    'wrong value copied from neighboring column',
    (p) => {
      p.claims[0].rawValue = p.claims[1].rawValue;
    },
  ],
  [
    'invented extra fact',
    (p) => {
      p.claims.push({ ...structuredClone(p.claims[0]), field: 'invented' });
    },
  ],
]) {
  test(`${name} fails claim precision and evidence validity`, () => {
    const prediction = predictionOf(pickup);
    mutate(prediction);
    const result = assess(prediction);
    assert.ok(result.metrics.claimPrecision < 1);
    assert.ok(result.metrics.evidenceValidity < 1);
    assert.ok(result.failures.length > 0);
  });
}

test('duplicate claims cannot inflate recall and fail the uniqueness gate', () => {
  const prediction = predictionOf(pickup);
  prediction.claims = Array.from({ length: 20 }, () =>
    structuredClone(prediction.claims[0]),
  );
  const result = assess(prediction);
  assert.equal(result.metrics.claimRecall, 1 / pickup.gold.claims.length);
  assert.equal(result.metrics.uniqueOutput, 0);
  assert.equal(result.counts.duplicateClaims, 19);
});

test('empty output fails recall when facts exist; correct genuinely empty gold passes', async () => {
  const prediction = predictionOf(pickup);
  prediction.claims = [];
  assert.equal(assess(prediction).metrics.claimRecall, 0);
  const empty = dataset.cases.find((item) => item.id === 'vehicle-not-found');
  assert.equal(
    (await scorePrediction(predictionOf(empty), empty.gold, empty.input))
      .passed,
    true,
  );
});

test('conflicting observations require every evidence anchor', () => {
  const item = dataset.cases.find(
    (value) => value.id === 'van-conflicting-rows',
  );
  const prediction = predictionOf(item);
  prediction.abstentions[0].evidence.pop();
  const result = assessPrediction(prediction, item.gold, item.input);
  assert.ok(result.metrics.abstentionRecall < 1);
});

test('speculating a resolved year for an ambiguous request fails identity', () => {
  const item = dataset.cases.find((value) => value.id === 'suv-year-ambiguity');
  const prediction = predictionOf(item);
  prediction.resolution = {
    status: 'resolved',
    vehicleIds: [prediction.variants[1].id],
  };
  assert.equal(
    assessPrediction(prediction, item.gold, item.input).metrics
      .identityAccuracy,
    0,
  );
});

test('confidence absence remains null and is not a fabricated zero-confidence observation', () => {
  const prediction = predictionOf(pickup);
  assert.equal(prediction.claims[0].confidence, null);
  assert.equal(assess(prediction).confidence.brierScore, null);
  prediction.claims[0].confidence = 0;
  assert.equal(assess(prediction).confidence.brierScore, 1);
});

test('source mutation without a new digest is rejected before candidate execution', async () => {
  const broken = structuredClone(dataset);
  broken.cases[0].input.sources[0].text += '\nchanged';
  let called = false;
  await assert.rejects(
    runBenchmark(broken, {
      run() {
        called = true;
      },
    }),
    /digest mismatch/u,
  );
  assert.equal(called, false);
});

test('candidate exceptions, missing output, invalid telemetry and timeouts fail closed', async () => {
  const one = { ...dataset, cases: [pickup] };
  for (const run of [
    async () => {
      throw new Error('simulated failure');
    },
    async () => ({}),
    async () => ({
      prediction: predictionOf(pickup),
      telemetry: { inputTokens: -1 },
    }),
  ]) {
    const report = await runBenchmark(one, { id: 'broken', run });
    assert.equal(report.passed, false);
    assert.equal(report.summary.failedTrials, 1);
    assert.equal(report.summary.costUsd, null);
  }
  const timeout = await runBenchmark(
    one,
    {
      id: 'timeout',
      run: () =>
        new Promise(() => {
          // Simulate a candidate that never settles so the runner must cancel it.
        }),
    },
    { timeoutMs: 5, repeats: 2 },
  );
  assert.equal(timeout.passed, false);
  assert.match(timeout.trials[0].error, /timed out/u);
  assert.equal(timeout.trials[1].skipped, true);
});

test('replay requires exact dataset version, digest and complete case membership', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'specsync-replay-test-'));
  try {
    const path = join(directory, 'replay.json');
    const manifest = {
      id: dataset.id,
      revision: dataset.revision,
      sha256: digest(JSON.stringify(dataset)),
      caseIds: dataset.cases.map((item) => item.id),
    };
    const replay = {
      schemaVersion: 1,
      datasetId: manifest.id,
      datasetRevision: manifest.revision,
      datasetSha256: manifest.sha256,
      predictions: Object.fromEntries(
        dataset.cases.map((item) => [item.id, predictionOf(item)]),
      ),
    };
    await writeFile(path, JSON.stringify(replay));
    const candidate = await replayCandidate(path, manifest);
    const report = await runBenchmark(dataset, candidate);
    assert.equal(report.passed, true);
    assert.equal(report.summary.costUsd, null);
    const missing = structuredClone(replay);
    delete missing.predictions[pickup.id];
    await writeFile(path, JSON.stringify(missing));
    await assert.rejects(
      replayCandidate(path, manifest),
      /exactly one prediction/u,
    );
    const extra = structuredClone(replay);
    extra.predictions.unknown = predictionOf(pickup);
    await writeFile(path, JSON.stringify(extra));
    await assert.rejects(
      replayCandidate(path, manifest),
      /exactly one prediction/u,
    );
    await writeFile(
      path,
      JSON.stringify({ ...replay, datasetSha256: '0'.repeat(64) }),
    );
    await assert.rejects(replayCandidate(path, manifest), /digest mismatch/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('CLI rejects unknown/duplicate/unbounded flags and never silently enables paid calls', () => {
  for (const args of [
    ['--unknown'],
    ['--repeats', '0'],
    ['--repeats', '11'],
    ['--repeats', '1.1'],
    ['--repeats', '1', '--repeats', '2'],
    ['--candidate', 'replay'],
    ['--candidate', 'openrouter'],
    ['--model', 'openrouter/vendor/model'],
    ['--max-output-tokens', '10'],
  ]) {
    assert.throws(() => parseArgs(args));
  }
  assert.equal(parseArgs([]).candidate, 'deterministic');
  assert.deepEqual(parseArgs(['--help']), { help: true });
});

test('live candidate resolves installed capabilities before requesting credentials; no model call', async () => {
  const require = createRequire(import.meta.url);
  const path = join(
    dirname(require.resolve('@mastra/core/package.json')),
    'dist/capabilities/openrouter.json',
  );
  const capabilities = JSON.parse(await readFile(path, 'utf8'));
  const previous = process.env['OPENROUTER_API_KEY'];
  delete process.env['OPENROUTER_API_KEY'];
  try {
    await assert.rejects(
      openrouterCandidate({
        model: `openrouter/${capabilities.structuredOutput[0]}`,
        maxOutputTokens: 100,
        timeoutMs: 1000,
      }),
      /OPENROUTER_API_KEY is required/u,
    );
  } finally {
    if (previous === undefined) delete process.env['OPENROUTER_API_KEY'];
    else process.env['OPENROUTER_API_KEY'] = previous;
  }
});

test('CLI writes a failed report and returns nonzero when replay data is missing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'specsync-cli-test-'));
  try {
    const path = join(directory, 'failed.json');
    const exit = await main([
      '--candidate',
      'replay',
      '--replay',
      join(directory, 'missing.json'),
      '--report',
      path,
    ]);
    assert.equal(exit, 1);
    assert.equal(JSON.parse(await readFile(path, 'utf8')).passed, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('curated Ranger notes fixture preserves unknown year and requires fuel-row evidence', async () => {
  const notes = validateDataset(
    JSON.parse(
      await readFile(
        new URL('./fixtures/ranger-notes-v1.json', import.meta.url),
        'utf8',
      ),
    ),
  );
  const item = notes.cases[0];
  assert.equal(notes.provenance, 'curated-notes');
  assert.equal(item.gold.variants.length, 5);
  assert.equal(item.gold.claims.length, 10);
  assert.ok(item.gold.variants.every((vehicle) => vehicle.modelYear === null));
  const prediction = predictionOf(item);
  assert.equal(
    (await scorePrediction(prediction, item.gold, item.input)).passed,
    true,
  );
  prediction.claims[0].evidence.pop();
  assert.ok(
    assessPrediction(prediction, item.gold, item.input).metrics.claimPrecision <
      1,
  );
  await assert.rejects(
    deterministicCandidate().run(item.input),
    /only supports synthetic/u,
  );
});
