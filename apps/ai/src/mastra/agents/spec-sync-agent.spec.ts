import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';

import { CHAT_EFFORT_KEY, CHAT_MODEL_KEY, gemini } from '../models';
import { CHAT_AGENT_ID, specSyncAgent } from './spec-sync-agent';

describe('SpecSync agent contract', () => {
  it('keeps the CopilotKit identity and keeps catalog writes outside agent tools', async () => {
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
        'discoverVehicleSpecificationSources',
        'previewVehicleSource',
        'prepareVehicleIngestion',
      ].sort(),
    );
  });
  it('loads the ingestion procedure as an agent skill', async () => {
    const skills = await specSyncAgent.listSkills();
    expect(skills.map((skill) => skill.name)).toEqual(['vehicle-ingestion']);
  });
  it('bounds agent rounds and retains the existing provider summary stream', async () => {
    expect(await specSyncAgent.getDefaultOptions()).toMatchObject({
      maxSteps: 10,
      providerOptions: {
        google: { thinkingConfig: { includeThoughts: true } },
      },
    });
  });
  it('applies the reasoning effort the request context names', async () => {
    const requestContext = new RequestContext();
    requestContext.set(CHAT_MODEL_KEY, 'gemini-2.5-pro');
    requestContext.set(CHAT_EFFORT_KEY, 'high');
    expect(await specSyncAgent.getDefaultOptions({ requestContext })).toEqual({
      maxSteps: 10,
      providerOptions: {
        google: {
          thinkingConfig: { includeThoughts: true, thinkingBudget: 24576 },
        },
      },
    });
  });
  it('runs on the default Gemini model unless the request context names another', async () => {
    // getModel wraps the model; compare identity through id and provider.
    expect(await specSyncAgent.getModel()).toMatchObject({
      modelId: gemini.modelId,
      provider: gemini.provider,
    });
    const requestContext = new RequestContext();
    requestContext.set(CHAT_MODEL_KEY, 'gemini-2.5-pro');
    expect(await specSyncAgent.getModel({ requestContext })).toMatchObject({
      modelId: 'gemini-2.5-pro',
    });
  });
});
