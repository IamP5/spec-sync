import { afterAll, expect, it } from 'vitest';

import { closeGraph } from './connection';
import { retrieveGraph } from './retrieval';

afterAll(closeGraph);
it('retrieves the deployed catalog projection without any Spring HTTP dependency', async () => {
  expect(process.env['NEO4J_URI']).toBeTruthy();
  const concepts = await retrieveGraph('concepts', { q: 'torque_max' });
  expect(concepts.status).toBe('OK');
  expect(concepts.items[0]?.['code']).toBe('torque_max');
  const capabilities = await retrieveGraph('capabilities', {
    attributeCode: 'camera_360',
  });
  expect(capabilities.status).toBe('OK');
  const item = capabilities.items.find(
    (item) =>
      item['configurationId'] === 'f94a2350-0a1a-5ad3-aef8-3c0c472c72a1',
  );
  expect(item?.['availability']).toBe('OPTIONAL');
  const evidenceId = (item?.['evidenceIds'] as string[] | undefined)?.[0];
  expect(evidenceId).toBeTruthy();
  expect(await retrieveGraph('evidence', { q: evidenceId })).toMatchObject({
    status: 'OK',
  });
  const related = await retrieveGraph('related-reviews', {
    configurationId: item?.['configurationId'],
    attributeCode: 'rear_suspension',
  });
  expect(['OK', 'EMPTY']).toContain(related.status);
  const reviews = await retrieveGraph('reviews', { q: 'suspensão' });
  expect(['OK', 'EMPTY']).toContain(reviews.status);
});
