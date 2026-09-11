import type { Message } from '@ag-ui/client';
import { describe, expect, it } from 'vitest';

import {
  RESEARCH_COMPLETION_ACTIVITY,
  researchCompletionOf,
} from './research-completion';

const content = {
  version: 1,
  requestId: 'b0bf3b8d-12fb-45ae-83d4-5b41b61c559a',
  workId: 'b98e8caa-d7e5-4440-8a9c-f5c267ab3fb1',
  status: 'REVIEW',
  vehicle: { brand: 'Ford', model: 'Ranger', market: 'BR', modelYear: 2025 },
  counts: { configurations: 2, claims: 40, warnings: 3 },
  updatedAt: '2026-09-10T12:00:00Z',
};
const activity: Message = {
  id: 'research-ready-persisted',
  role: 'activity',
  activityType: RESEARCH_COMPLETION_ACTIVITY,
  content,
};

describe('research completion rendering contract', () => {
  it('returns the declared snapshot and authenticated research reference', () => {
    expect(researchCompletionOf(activity)).toEqual(content);
  });

  it('does not infer an event from assistant text or a different activity', () => {
    expect(
      researchCompletionOf({
        id: 'text',
        role: 'assistant',
        content: JSON.stringify(content),
      }),
    ).toBeUndefined();
    expect(
      researchCompletionOf({ ...activity, activityType: 'another.activity' }),
    ).toBeUndefined();
  });

  it.each([
    { version: 2 },
    { requestId: 'not-a-reference' },
    { status: 'PROCESSING' },
    { counts: { configurations: 2, claims: -1, warnings: 3 } },
    { updatedAt: 'yesterday' },
    { vehicle: { ...content.vehicle, market: 'US' } },
    { html: '<script>execute()</script>' },
  ])(
    'rejects malformed, unsupported or undeclared completion fields: %j',
    (invalid) => {
      expect(
        researchCompletionOf({
          ...activity,
          content: { ...content, ...invalid },
        }),
      ).toBeUndefined();
    },
  );
});
