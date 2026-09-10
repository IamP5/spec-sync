import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import {
  deterministicCandidate,
  openrouterCandidate,
  replayCandidate,
} from './candidates.mjs';
import { digest, predictionSchema, validateDataset } from './contracts.mjs';
import { SCORER_VERSION, scorePrediction } from './scorers.mjs';

export const defaultDatasetPath = fileURLToPath(
  new URL('./fixtures/synthetic-br-v1.json', import.meta.url),
);
const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url));
const numberOrNull = z.number().finite().nonnegative().nullable();
const telemetrySchema = z
  .object({
    inputTokens: numberOrNull,
    outputTokens: numberOrNull,
    modelCalls: numberOrNull,
    costUsd: numberOrNull,
  })
  .strict();

export const HELP = `SpecSync source extraction benchmark (offline by default)

Usage: npm exec -- nx run ai:benchmark -- [options]
  --candidate deterministic|replay|openrouter  Default: deterministic
  --dataset PATH             Default: synthetic-br-v1.json
  --replay PATH              Required only for replay; exact full dataset coverage
  --model openrouter/VENDOR/MODEL  Required only for openrouter; makes paid model calls
  --repeats N                1..10, default 1; maximum 200 total trials
  --timeout-ms N             1..120000 per trial, default 30000
  --max-run-ms N             1..600000 total, default 120000
  --max-output-tokens N      1..16384, default 8192; openrouter only
  --max-input-chars N        1..200000, default 100000
  --report PATH              Default: dist/benchmarks/<timestamp>.json
  --help                    Show usage; never runs a model

Every exact contract gate must pass for every trial; errors and skipped cases fail.
Synthetic fixture success is not a measurement of real vehicle or production quality.
Replay measures scoring only. OpenRouter measures frozen-text extraction only.
`;

export function parseArgs(args) {
  const options = {
    candidate: 'deterministic',
    dataset: defaultDatasetPath,
    repeats: 1,
    timeoutMs: 30000,
    maxRunMs: 120000,
    maxOutputTokens: 8192,
    maxInputChars: 100000,
  };
  const names = {
    '--candidate': 'candidate',
    '--dataset': 'dataset',
    '--replay': 'replay',
    '--model': 'model',
    '--repeats': 'repeats',
    '--timeout-ms': 'timeoutMs',
    '--max-run-ms': 'maxRunMs',
    '--max-output-tokens': 'maxOutputTokens',
    '--max-input-chars': 'maxInputChars',
    '--report': 'report',
  };
  const limits = {
    repeats: 10,
    timeoutMs: 120000,
    maxRunMs: 600000,
    maxOutputTokens: 16384,
    maxInputChars: 200000,
  };
  const seen = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') continue;
    if (arg === '--help') {
      if (args.length !== 1)
        throw new Error('--help cannot be combined with other options');
      return { help: true };
    }
    const key = names[arg];
    if (!key) throw new Error(`Unknown option: ${arg}`);
    if (seen.has(key)) throw new Error(`Duplicate option: ${arg}`);
    seen.add(key);
    const value = args[++index];
    if (!value || value.startsWith('--'))
      throw new Error(`Missing value for ${arg}`);
    if (key in limits) {
      if (
        !/^\d+$/u.test(value) ||
        !Number.isSafeInteger(Number(value)) ||
        Number(value) < 1 ||
        Number(value) > limits[key]
      ) {
        throw new Error(`${arg} must be an integer from 1 to ${limits[key]}`);
      }
      options[key] = Number(value);
    } else options[key] = value;
  }
  if (!['deterministic', 'replay', 'openrouter'].includes(options.candidate))
    throw new Error('Invalid candidate');
  if (options.candidate === 'replay' && !options.replay)
    throw new Error('--replay is required for replay');
  if (options.candidate !== 'replay' && options.replay)
    throw new Error('--replay requires the replay candidate');
  if (options.candidate === 'openrouter' && !options.model)
    throw new Error('--model is required for openrouter');
  if (
    options.candidate !== 'openrouter' &&
    (options.model || seen.has('maxOutputTokens'))
  )
    throw new Error('--model/--max-output-tokens require openrouter');
  return options;
}

function environment() {
  const require = createRequire(import.meta.url);
  let commit = null;
  let dirty = null;
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    dirty =
      execFileSync('git', ['status', '--porcelain'], {
        cwd: workspaceRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim().length > 0;
  } catch {
    /* Reports remain useful outside a Git checkout. */
  }
  const sourceHashes = Object.fromEntries(
    ['contracts.mjs', 'scorers.mjs', 'candidates.mjs', 'run.mjs'].map(
      (name) => [name, digest(readFileSync(new URL(name, import.meta.url)))],
    ),
  );
  return {
    node: process.version,
    mastraCore: require('@mastra/core/package.json').version,
    scorerVersion: SCORER_VERSION,
    lockfileSha256: digest(
      readFileSync(resolve(workspaceRoot, 'package-lock.json')),
    ),
    sourceHashes,
    commit,
    dirty,
  };
}

async function boundedRun(candidate, input, context, timeoutMs) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(
        'Candidate trial timed out; remaining trials are skipped',
      );
      error.name = 'TimeoutError';
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() =>
        candidate.run(structuredClone(input), {
          ...context,
          signal: controller.signal,
        }),
      ),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function runBenchmark(rawDataset, candidate, options = {}) {
  const dataset = validateDataset(rawDataset);
  const repeats = options.repeats ?? 1;
  const timeoutMs = options.timeoutMs ?? 30000;
  const maxRunMs = options.maxRunMs ?? 120000;
  const maxInputChars = options.maxInputChars ?? 100000;
  if (
    !Number.isInteger(repeats) ||
    repeats < 1 ||
    repeats > 10 ||
    dataset.cases.length * repeats > 200
  )
    throw new Error('Trial budget exceeded');
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 120000 ||
    !Number.isInteger(maxRunMs) ||
    maxRunMs < 1 ||
    maxRunMs > 600000
  )
    throw new Error('Invalid time budget');
  if (
    !Number.isInteger(maxInputChars) ||
    maxInputChars < 1 ||
    maxInputChars > 200000
  )
    throw new Error('Invalid input budget');
  for (const item of dataset.cases) {
    if (JSON.stringify(item.input).length > maxInputChars)
      throw new Error(`Input budget exceeded: ${item.id}`);
  }
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const trials = [];
  let abortRemaining = false;
  for (let attempt = 0; attempt < repeats; attempt += 1) {
    for (const item of dataset.cases) {
      const trialStarted = performance.now();
      const base = { caseId: item.id, attempt, tags: item.tags };
      const remaining = maxRunMs - (performance.now() - started);
      if (abortRemaining || remaining <= 0) {
        trials.push({
          ...base,
          passed: false,
          skipped: true,
          error: 'Run budget exhausted or a previous trial timed out',
          prediction: null,
          telemetry: null,
        });
        continue;
      }
      try {
        const result = await boundedRun(
          candidate,
          item.input,
          { caseId: item.id, attempt },
          Math.min(timeoutMs, remaining),
        );
        const prediction = predictionSchema.parse(result.prediction);
        const telemetry = telemetrySchema.parse(result.telemetry);
        const candidateLatencyMs = performance.now() - trialStarted;
        const assessment = await scorePrediction(
          prediction,
          item.gold,
          item.input,
        );
        trials.push({
          ...base,
          ...assessment,
          prediction,
          telemetry,
          candidateLatencyMs,
          durationMs: performance.now() - trialStarted,
        });
      } catch (error) {
        if (error?.name === 'TimeoutError') abortRemaining = true;
        trials.push({
          ...base,
          passed: false,
          skipped: false,
          error:
            error instanceof Error ? error.message : 'Unknown candidate error',
          prediction: null,
          telemetry: null,
          durationMs: performance.now() - trialStarted,
        });
      }
    }
  }
  const measured = trials.filter((trial) => trial.scores);
  const scores = {};
  for (const key of Object.keys(measured[0]?.scores ?? {}))
    scores[key] =
      measured.reduce((sum, trial) => sum + trial.scores[key], 0) /
      measured.length;
  const sumTelemetry = (key) =>
    trials.every(
      (trial) =>
        trial.telemetry?.[key] !== null && trial.telemetry?.[key] !== undefined,
    )
      ? trials.reduce((sum, trial) => sum + trial.telemetry[key], 0)
      : null;
  return {
    schemaVersion: 1,
    startedAt,
    scope: dataset.synthetic
      ? 'synthetic-contract-only'
      : 'fixed-source-extraction-only',
    limitations: [
      'No production accuracy claim',
      'No live discovery/OCR evaluation',
      'Parsed requested identity supplied',
      'No production shared-search/concurrency guarantee',
      'Confidence values are not calibrated',
      'Replay repetitions are not independent model samples',
    ],
    dataset: {
      id: dataset.id,
      revision: dataset.revision,
      provenance: dataset.provenance,
      sha256: digest(JSON.stringify(dataset)),
      caseCount: dataset.cases.length,
      sources: dataset.cases.flatMap((item) =>
        item.input.sources.map((source) => ({
          caseId: item.id,
          id: source.id,
          revision: source.revision,
          sha256: source.sha256,
        })),
      ),
    },
    candidate: {
      id: candidate.id,
      version: candidate.version,
      ...candidate.metadata,
    },
    environment: environment(),
    budgets: {
      repeats,
      timeoutMs,
      maxRunMs,
      maxInputChars,
      totalTrials: dataset.cases.length * repeats,
    },
    passed:
      trials.length === dataset.cases.length * repeats &&
      trials.every((trial) => trial.passed === true),
    summary: {
      totalTrials: trials.length,
      passedTrials: trials.filter((trial) => trial.passed).length,
      failedTrials: trials.filter((trial) => !trial.passed).length,
      scoredTrials: measured.length,
      scores,
      scoreAggregation:
        'mean over scored trials only; every errored/skipped trial still fails the report',
      durationMs: performance.now() - started,
      inputTokens: sumTelemetry('inputTokens'),
      outputTokens: sumTelemetry('outputTokens'),
      modelCalls: sumTelemetry('modelCalls'),
      costUsd: sumTelemetry('costUsd'),
    },
    trials,
  };
}

export async function main(args = process.argv.slice(2)) {
  let reportPath = resolve(
    workspaceRoot,
    'dist/benchmarks',
    `${new Date().toISOString().replaceAll(':', '-')}.json`,
  );
  try {
    const options = parseArgs(args);
    if (options.help) {
      console.log(HELP);
      return 0;
    }
    if (options.report) reportPath = resolve(options.report);
    const dataset = validateDataset(
      JSON.parse(await readFile(options.dataset, 'utf8')),
    );
    const manifest = {
      id: dataset.id,
      revision: dataset.revision,
      sha256: digest(JSON.stringify(dataset)),
      caseIds: dataset.cases.map((item) => item.id),
    };
    const candidate =
      options.candidate === 'deterministic'
        ? deterministicCandidate()
        : options.candidate === 'replay'
          ? await replayCandidate(options.replay, manifest)
          : await openrouterCandidate(options);
    const report = await runBenchmark(dataset, candidate, options);
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(
      `${report.passed ? 'PASS' : 'FAIL'} ${report.summary.passedTrials}/${report.summary.totalTrials} trials; ${reportPath}`,
    );
    return report.passed ? 0 : 1;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown benchmark error';
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(
      reportPath,
      `${JSON.stringify({ schemaVersion: 1, passed: false, error: message, startedAt: new Date().toISOString() }, null, 2)}\n`,
    );
    console.error(`FAIL ${message}; ${reportPath}`);
    return 1;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  process.exitCode = await main();
