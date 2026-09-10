import { createHash } from 'node:crypto';

import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

import {
  configurationDraftSchema,
  type Draft,
  draftSchema,
  extractConfigurationClaims,
  sourceSchema,
} from '../ingestion/extraction';
import {
  identifiedConfigurationSchema,
  identifyConfigurations,
  legendSchema,
  selectConfigurations,
} from '../ingestion/identification';
import { captureSource, validateSourceUrl } from '../ingestion/source';
import { researchRequest } from './client';
import { type SharedExtractionInput, sharedExtractionInput } from './contracts';

export const SHARED_VEHICLE_RESEARCH_WORKFLOW_ID = 'sharedVehicleResearch';
export const COVERAGE_WARNING =
  'Research is bounded to 8 configurations, 24 PDF pages, 100 claims and 100 unmapped observations per configuration. Complete document coverage is not certified; extracted claims require curator review.';
const capturedSchema = sourceSchema.extend({
  pageCount: z.number().int().nonnegative(),
});
const identificationSchema = z.object({
  configurations: z.array(identifiedConfigurationSchema),
  legend: legendSchema,
  modelYearNote: z.string().nullable(),
  notes: z.array(z.string()),
});
const checkpointsSchema = z.object({
  checkpoints: z.array(z.object({ key: z.string(), payload: z.string() })),
});
const acknowledgedSchema = z.object({ ok: z.literal(true) });

/** Capture remains reusable; interpretation changes never overwrite earlier extraction. */
export function interpretationKey(
  input: SharedExtractionInput,
  readerRevision: string,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        ontology: input.ontologyRevision ?? 0,
        normalization: input.normalizationRevision ?? 'numeric-v3',
        reader: readerRevision,
        policy: input.policyVersion,
        extraction: 'ontology-extraction-v2',
      }),
    )
    .digest('hex')
    .slice(0, 20);
}

export function assertResearchPolicy(input: SharedExtractionInput): void {
  if (
    input.policyVersion !==
    (process.env['SPECSYNC_RESEARCH_POLICY_VERSION'] ?? 'br-v1')
  )
    throw new Error(
      'Research policy changed; the work must be recreated with the active policy.',
    );
  validateSourceUrl(input.request.sourceUrl);
}

/**
 * API leases and immutable checkpoints own recovery. This execution keeps only
 * transient state; another attempt reuses completed stages from PostgreSQL.
 */
export async function executeSharedResearch(
  input: SharedExtractionInput,
  outerSignal: AbortSignal,
): Promise<Draft> {
  outerSignal.throwIfAborted();
  assertResearchPolicy(input);
  const ownership = new AbortController();
  const signal = AbortSignal.any([
    outerSignal,
    ownership.signal,
    AbortSignal.timeout(20 * 60_000),
  ]);
  const base = `/works/${input.workId}/attempts/${input.attemptId}`;
  const assertOwnership = async () => {
    signal.throwIfAborted();
    try {
      await researchRequest(
        'POST',
        `${base}/heartbeat`,
        undefined,
        acknowledgedSchema,
        signal,
      );
      signal.throwIfAborted();
    } catch (error) {
      ownership.abort(error);
      throw error;
    }
  };
  let heartbeatRunning = false;
  const heartbeat = setInterval(() => {
    if (heartbeatRunning || signal.aborted) return;
    heartbeatRunning = true;
    void assertOwnership()
      .catch(() => undefined)
      .finally(() => {
        heartbeatRunning = false;
      });
  }, 30_000);
  heartbeat.unref();
  try {
    await assertOwnership();
    const saved = await researchRequest(
      'GET',
      `${base}/checkpoints`,
      undefined,
      checkpointsSchema,
      signal,
    );
    const checkpoints = new Map(
      saved.checkpoints.map((item) => [item.key, item.payload]),
    );
    const stage = async <T>(
      key: string,
      schema: z.ZodType<T>,
      operation: () => Promise<T>,
    ): Promise<T> => {
      await assertOwnership();
      const existing = checkpoints.get(key);
      if (existing !== undefined) return schema.parse(JSON.parse(existing));
      const value = schema.parse(await operation());
      await assertOwnership();
      const payload = JSON.stringify(value);
      await researchRequest(
        'PUT',
        `${base}/checkpoints/${key}`,
        { payload },
        acknowledgedSchema,
        signal,
      );
      signal.throwIfAborted();
      checkpoints.set(key, payload);
      return value;
    };
    // A user's selected trim never narrows the shared document work.
    const request = { ...input.request, configurations: [] };
    const source = await stage('capture-source', capturedSchema, () =>
      captureSource(
        request.sourceUrl,
        signal,
        undefined,
        undefined,
        assertOwnership,
      ),
    );
    const identification = await stage(
      'identify-configurations',
      identificationSchema,
      () => identifyConfigurations(source.text, request, signal),
    );
    const selection = selectConfigurations([], identification.configurations);
    const revision = interpretationKey(input, source.parserVersion);
    const configurations = new Array<z.infer<typeof configurationDraftSchema>>(
      selection.scopes.length,
    );
    let next = 0;
    const workers = Array.from(
      { length: Math.min(2, selection.scopes.length) },
      async () => {
        try {
          while (next < selection.scopes.length) {
            signal.throwIfAborted();
            const index = next++;
            const scope = selection.scopes[index];
            if (!scope) break;
            configurations[index] = await stage(
              `extract-${revision}-configuration-${index}`,
              configurationDraftSchema,
              () =>
                extractConfigurationClaims(
                  {
                    text: source.text,
                    request,
                    attributes: input.attributes,
                    scope,
                    legend: identification.legend,
                    terminology: input.terminology,
                    attributeValues: input.attributeValues,
                    readerRevision: source.parserVersion,
                  },
                  signal,
                  assertOwnership,
                ),
            );
          }
        } catch (error) {
          ownership.abort(error);
          throw error;
        }
      },
    );
    const results = await Promise.allSettled(workers);
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    await assertOwnership();
    return draftSchema.parse({
      source,
      configurations,
      ontologyRevision: input.ontologyRevision ?? 0,
      normalizationRevision: input.normalizationRevision ?? 'numeric-v3',
      readerRevision: source.parserVersion,
      warnings: [
        ...selection.warnings,
        ...identification.notes,
        identification.modelYearNote
          ? `Model year stated by the source: ${identification.modelYearNote}`
          : 'The source does not state a model year; confirm applicability before publishing.',
        COVERAGE_WARNING,
      ],
    });
  } finally {
    clearInterval(heartbeat);
    ownership.abort();
  }
}

const researchStep = createStep({
  id: 'research-with-api-checkpoints',
  description:
    'Capture, identify and extract shared source evidence with API-owned leases and stage checkpoints',
  inputSchema: sharedExtractionInput,
  outputSchema: draftSchema,
  execute: ({ inputData, abortSignal }) =>
    executeSharedResearch(
      inputData,
      abortSignal ?? new AbortController().signal,
    ),
});

export const sharedVehicleResearchWorkflow = createWorkflow({
  id: SHARED_VEHICLE_RESEARCH_WORKFLOW_ID,
  inputSchema: sharedExtractionInput,
  outputSchema: draftSchema,
  // Mastra restart scanning must never compete with the API lease owner.
  options: { shouldPersistSnapshot: () => false },
})
  .then(researchStep)
  .commit();

export async function runSharedResearch(
  input: unknown,
  signal: AbortSignal,
): Promise<Draft> {
  signal.throwIfAborted();
  const parsed = sharedExtractionInput.parse(input);
  assertResearchPolicy(parsed);
  const run = await sharedVehicleResearchWorkflow.createRun({
    runId: parsed.attemptId,
  });
  const cancel = () => void run.cancel().catch(() => undefined);
  signal.addEventListener('abort', cancel, { once: true });
  try {
    signal.throwIfAborted();
    const result = await run.start({ inputData: parsed });
    signal.throwIfAborted();
    if (result.status === 'success') return draftSchema.parse(result.result);
    throw new Error('Shared research attempt did not complete.');
  } finally {
    signal.removeEventListener('abort', cancel);
  }
}
