import { timingSafeEqual } from 'node:crypto';

import { registerApiRoute } from '@mastra/core/server';

import { extractionInput, extractVehicle } from './extraction';
import { projectIngestion, projectionInput } from './projection';
export function authorizedWorker(header: string | undefined): boolean {
  const key = process.env['SPECSYNC_INGESTION_WORKER_KEY'];
  if (!key || key.length < 32 || !header) return false;
  const expected = Buffer.from(`Bearer ${key}`),
    supplied = Buffer.from(header);
  return (
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  );
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
        const input = extractionInput.parse(JSON.parse(text));
        return c.json(await extractVehicle(input, c.req.raw.signal));
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
