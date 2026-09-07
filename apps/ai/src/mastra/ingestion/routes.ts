import { timingSafeEqual } from 'node:crypto';

import { registerApiRoute } from '@mastra/core/server';

import { extractionInput } from './extraction';
import { projectIngestion, projectionInput } from './projection';
import { vehicleIngestionWorkflow } from './workflow';

export function authorizedWorker(header: string | undefined): boolean {
  const key = process.env['SPECSYNC_INGESTION_WORKER_KEY'];
  if (!key || key.length < 32 || !header) return false;
  const expected = Buffer.from(`Bearer ${key}`),
    supplied = Buffer.from(header);
  return (
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  );
}

/**
 * Runs the ingestion workflow for one API-owned run and returns the draft.
 * The API worker calls this with its worker key; the run's status, retries
 * and review stay in PostgreSQL.
 */
export async function runIngestion(input: unknown, signal: AbortSignal) {
  const parsed = extractionInput.parse(input);
  const run = await vehicleIngestionWorkflow.createRun();
  const cancel = () => void run.cancel().catch(() => undefined);
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const result = await run.start({ inputData: parsed });
    if (result.status === 'success') return result.result;
    if (result.status === 'failed')
      throw result.error instanceof Error
        ? result.error
        : new Error(String(result.error ?? 'Ingestion workflow failed'));
    throw new Error(`Ingestion workflow ended with status ${result.status}`);
  } finally {
    signal.removeEventListener('abort', cancel);
  }
}

export const ingestionRoutes = [
  registerApiRoute('/internal/ingestion/extract', {
    method: 'POST',
    handler: async (c) => {
      if (!authorizedWorker(c.req.header('Authorization')))
        return c.json({ error: 'Unauthorized' }, 401);
      try {
        const text = await c.req.text();
        if (text.length > 100000)
          return c.json({ error: 'Request too large' }, 413);
        return c.json(await runIngestion(JSON.parse(text), c.req.raw.signal));
      } catch (error) {
        console.error('Ingestion extraction failed', error);
        return c.json(
          {
            error: error instanceof Error ? error.message : 'Extraction failed',
          },
          422,
        );
      }
    },
  }),
  registerApiRoute('/internal/ingestion/project', {
    method: 'POST',
    handler: async (c) => {
      if (!authorizedWorker(c.req.header('Authorization')))
        return c.json({ error: 'Unauthorized' }, 401);
      try {
        const text = await c.req.text();
        if (text.length > 20000000)
          return c.json(
            { error: 'Projection exceeds full-rebuild limit' },
            413,
          );
        await projectIngestion(projectionInput.parse(JSON.parse(text)));
        return c.json({ status: 'CURRENT' });
      } catch (error) {
        console.error('Ingestion projection failed', error);
        return c.json(
          { error: 'Projection failed; PostgreSQL publication is preserved' },
          503,
        );
      }
    },
  }),
];
