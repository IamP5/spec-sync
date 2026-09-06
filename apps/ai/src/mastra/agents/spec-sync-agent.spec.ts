import { describe, expect, it } from 'vitest';

import { CHAT_AGENT_ID, specSyncAgent } from './spec-sync-agent';

describe('SpecSync agent contract', () => {
  it('keeps the CopilotKit identity and registers retrieval-only tools', async () => {
    expect(CHAT_AGENT_ID).toBe('chat');
    expect(specSyncAgent.id).toBe('chat');
    expect(Object.keys(await specSyncAgent.listTools()).sort()).toEqual(
      [
        'searchVehicleConfigurations',
        'listComparisonAttributes',
        'compareVehicleConfigurations',
        'getVehicleSpecifications',
        'resolveComparisonConcepts',
        'findConfigurationsByCapabilities',
        'searchReviewEvidence',
        'getRelatedReviews',
        'getEvidenceExcerpt',
        'discoverVehicleContent',
      ].sort(),
    );
  });
  it('bounds agent rounds and retains the existing provider summary stream', async () => {
    expect(await specSyncAgent.getDefaultOptions()).toMatchObject({
      maxSteps: 10,
      providerOptions: {
        google: { thinkingConfig: { includeThoughts: true } },
      },
    });
  });
});
