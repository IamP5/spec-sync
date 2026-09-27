import type { Message } from '@ag-ui/client';

import { toolPresentation } from './tool-presentation';

function tool(
  id: string,
  name: string,
  result: object,
  args: object = {},
): Message[] {
  return [
    {
      id: `a-${id}`,
      role: 'assistant',
      toolCalls: [
        {
          id,
          type: 'function',
          function: { name, arguments: JSON.stringify(args) },
        },
      ],
    },
    {
      id: `r-${id}`,
      role: 'tool',
      toolCallId: id,
      content: JSON.stringify(result),
    },
  ];
}
const user = (id: string): Message => ({
  id,
  role: 'user',
  content: 'Research vehicles',
});
const rendered = (messages: Message[]) =>
  [...toolPresentation(messages).values()].flatMap(
    (view) => view.message.toolCalls ?? [],
  );

describe('tool display projection', () => {
  it('leaves catalog rendering to its component while retaining legacy discovery summaries', () => {
    const messages = [
      user('u1'),
      ...tool(
        'c1',
        'searchVehicleConfigurations',
        { items: [] },
        { q: 'Ford F-150', modelYear: 2026 },
      ),
      ...tool(
        'd1',
        'discoverVehicleContent',
        { status: 'EMPTY', items: [] },
        { vehicle: 'RAM 1500' },
      ),
      ...tool(
        'd2',
        'discoverVehicleContent',
        { status: 'EMPTY', items: [] },
        { vehicle: 'RAM 1500' },
      ),
    ];
    const snapshot = structuredClone(messages);
    const views = [...toolPresentation(messages).values()];
    expect(rendered(messages).map((call) => call.id)).toEqual(['c1']);
    expect(
      views.flatMap((view) => view.notes).map((note) => note.text),
    ).toEqual(['No external links found for RAM 1500 (2 searches).']);
    expect(messages).toEqual(snapshot);
  });

  it('keeps one surface per research request and points later calls back at it', () => {
    const messages = [
      user('u1'),
      ...tool('start', 'researchVehicleSpecifications', { id: 'research' }),
      ...tool('status', 'getVehicleResearch', {
        id: 'research',
        status: 'PROCESSING',
      }),
      user('u2'),
      ...tool('reopen', 'reviewVehicleResearch', {
        id: 'research',
        reviewReady: true,
      }),
    ];
    expect(rendered(messages).map((call) => call.id)).toEqual(['start']);
    const views = toolPresentation(messages);
    expect(views.get('a-status')?.notes).toEqual([
      {
        id: 'status',
        text: 'Research status: processing. The research is shown above.',
        researchId: 'research',
      },
    ]);
    expect(views.get('a-reopen')?.notes[0]).toMatchObject({
      researchId: 'research',
      text: 'The review of this research is in its card above.',
    });
  });

  it('keeps distinct research interpretations and the replacement job while summarizing its earlier failed request', () => {
    const messages = [
      user('u1'),
      ...tool('start', 'researchVehicleSpecifications', { id: 'original' }),
      user('u2'),
      ...tool('status', 'getVehicleResearch', {
        id: 'original',
        status: 'FAILED',
      }),
      ...tool('retry', 'researchVehicleSpecifications', { id: 'replacement' }),
    ];
    expect(rendered(messages).map((call) => call.id)).toEqual([
      'start',
      'retry',
    ]);
    expect(
      toolPresentation(messages).get('a-status')?.notes[0]?.text,
    ).toContain('failed');
  });

  it('preserves failures, nonempty catalogs, comparisons and pending human confirmation', () => {
    const messages = [
      user('u1'),
      ...tool('failed', 'searchVehicleConfigurations', {
        status: 'UNAVAILABLE',
        message: 'Catalog unavailable',
      }),
      ...tool('catalog', 'searchVehicleConfigurations', {
        items: [{ id: 'vehicle' }],
      }),
      ...tool('comparison', 'compareVehicleConfigurations', { columns: [] }),
      {
        id: 'a-hitl',
        role: 'assistant',
        toolCalls: [
          {
            id: 'hitl',
            type: 'function',
            function: { name: 'startVehicleIngestion', arguments: '{}' },
          },
        ],
      } as Message,
    ];
    expect(rendered(messages).map((call) => call.id)).toEqual([
      'failed',
      'catalog',
      'comparison',
      'hitl',
    ]);
  });
});

it('retains safe official evidence and warnings in a compact disclosure after research starts', () => {
  const messages = [
    user('u1'),
    ...tool(
      'source',
      'discoverVehicleSpecificationSources',
      {
        status: 'OK',
        warnings: ['Model year requires confirmation'],
        items: [
          { title: 'Ford evidence', url: 'https://www.ford.com.br/specs.pdf' },
          { title: 'Unsafe', url: 'javascript:alert(1)' },
        ],
      },
      { brand: 'Ford', model: 'F-150' },
    ),
    ...tool('start', 'researchVehicleSpecifications', { id: 'research' }),
  ];
  const source = toolPresentation(messages).get('a-source');
  expect(source?.message.toolCalls).toHaveLength(0);
  expect(source?.notes[0]?.sources).toEqual([
    { title: 'Ford evidence', url: 'https://www.ford.com.br/specs.pdf' },
  ]);
  expect(source?.notes[0]?.warnings).toEqual([
    'Model year requires confirmation',
  ]);
});

it('keeps discovery visible when starting research fails or is still pending', () => {
  const messages = [
    user('u1'),
    ...tool('source', 'discoverVehicleSpecificationSources', {
      status: 'OK',
      items: [{ url: 'https://www.ford.com.br/specs.pdf' }],
    }),
    ...tool('start', 'researchVehicleSpecifications', {
      status: 'UNAVAILABLE',
    }),
  ];
  expect(rendered(messages).map((call) => call.id)).toEqual([
    'source',
    'start',
  ]);
});

it('groups empty official lookups without losing their warnings', () => {
  const messages = [
    user('u1'),
    ...tool('s1', 'discoverVehicleSpecificationSources', {
      status: 'EMPTY',
      items: [],
      warnings: ['Unsupported brand'],
    }),
    ...tool('s2', 'discoverVehicleSpecificationSources', {
      status: 'EMPTY',
      items: [],
      warnings: ['Unsupported brand', 'Year missing'],
    }),
  ];
  const notes = [...toolPresentation(messages).values()].flatMap(
    (view) => view.notes,
  );
  expect(rendered(messages)).toHaveLength(0);
  expect(notes).toHaveLength(1);
  expect(notes[0]?.warnings).toEqual(['Unsupported brand', 'Year missing']);
});

it('mounts a review card only for a request without an earlier surface and never rewrites history', () => {
  const messages = [
    user('u1'),
    ...tool('start', 'researchVehicleSpecifications', {
      id: 'private-a',
      workId: 'shared',
    }),
    user('u2'),
    ...tool('ready', 'reviewVehicleResearch', {
      id: 'private-a',
      workId: 'shared',
    }),
    user('u3'),
    ...tool('review-again', 'reviewVehicleResearch', {
      id: 'private-b',
      workId: 'shared',
    }),
  ];
  const before = structuredClone(messages);
  expect(rendered(messages).map((call) => call.id)).toEqual([
    'start',
    'review-again',
  ]);
  expect(messages).toEqual(before);
});
