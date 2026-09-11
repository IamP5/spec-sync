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

describe('declared tool presentation', () => {
  it('renders every user-facing catalog and discovery call independently without rewriting results', () => {
    const messages = [
      user('u1'),
      ...tool('c1', 'searchVehicleConfigurations', { items: [] }),
      ...tool('d1', 'discoverVehicleContent', { status: 'EMPTY', items: [] }),
      ...tool('d2', 'discoverVehicleContent', { status: 'EMPTY', items: [] }),
    ];
    const before = structuredClone(messages);
    expect(rendered(messages).map((call) => call.id)).toEqual([
      'c1',
      'd1',
      'd2',
    ]);
    expect(
      [...toolPresentation(messages).values()].flatMap((view) => view.notes),
    ).toEqual([]);
    expect(messages).toEqual(before);
  });

  it('does not infer research supersession from request IDs, neighboring calls or shared work', () => {
    const messages = [
      user('u1'),
      ...tool('source', 'discoverVehicleSpecificationSources', {
        status: 'OK',
        items: [{ title: 'Source', url: 'https://ford.com/specs' }],
      }),
      ...tool('start', 'researchVehicleSpecifications', {
        id: 'request',
        workId: 'shared',
      }),
      ...tool('status', 'getVehicleResearch', {
        id: 'request',
        status: 'FAILED',
      }),
      user('u2'),
      ...tool('review', 'reviewVehicleResearch', {
        id: 'request',
        workId: 'shared',
      }),
    ];
    expect(rendered(messages).map((call) => call.id)).toEqual([
      'source',
      'start',
      'status',
      'review',
    ]);
  });

  it('applies the declared background policy while keeping failures visible', () => {
    const messages = [
      ...tool('lookup', 'listComparisonAttributes', { items: [] }),
      ...tool('concept', 'resolveComparisonConcepts', {
        status: 'EMPTY',
        items: [],
      }),
      ...tool('failed', 'resolveComparisonConcepts', {
        status: 'UNAVAILABLE',
        message: 'Graph unavailable',
      }),
      ...tool('other', 'futureTool', { status: 'OK' }),
    ];
    expect(rendered(messages).map((call) => call.id)).toEqual([
      'failed',
      'other',
    ]);
  });

  it('deduplicates only the same invocation ID and keeps pending human actions', () => {
    const messages = [
      ...tool('same', 'searchVehicleConfigurations', { items: [] }).map(
        (message) => ({ ...message, id: `${message.id}-first` }),
      ),
      ...tool('same', 'searchVehicleConfigurations', { items: [] }),
      {
        id: 'pending',
        role: 'assistant',
        toolCalls: [
          {
            id: 'human',
            type: 'function',
            function: { name: 'startVehicleIngestion', arguments: '{}' },
          },
        ],
      } as Message,
    ];
    expect(rendered(messages).map((call) => call.id)).toEqual([
      'same',
      'human',
    ]);
  });
});
