import { render, screen } from '@testing-library/react-native';

import type { ToolCallView } from '../../data/tool-call';
import {
  ChatVehicleResearchOverview,
  researchReferenceSchema,
} from './chat-vehicle-research-overview';

// The journal itself is covered in the vehicles domain; this spec checks the adapter.
jest.mock('../../../vehicles/api/features', () => ({
  VehicleResearchDetail: ({ requestId }: { requestId: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`research ${requestId}`}</Text>;
  },
}));

const RESEARCH_ID = '0deba290-126f-40f2-8583-766f9b7626fd';
const actions = { draft: jest.fn(), send: jest.fn(), canSend: true };

function call(overrides: Partial<ToolCallView>): ToolCallView {
  return {
    id: 'call-1',
    name: 'researchVehicleSpecifications',
    args: {},
    status: 'complete',
    ...overrides,
  };
}

describe('Chat vehicle research card', () => {
  it('takes only the request id and review readiness from the tool output', () => {
    expect(
      researchReferenceSchema.parse({
        id: RESEARCH_ID,
        reviewReady: true,
        stage: 'Stale tool output must not be displayed',
      }),
    ).toEqual({ id: RESEARCH_ID, reviewReady: true });
    expect(researchReferenceSchema.safeParse({ id: 'nope' }).success).toBe(
      false,
    );
  });

  it('says it is connecting while the tool runs', () => {
    render(
      <ChatVehicleResearchOverview
        call={call({ status: 'executing' })}
        actions={actions}
      />,
    );
    expect(screen.getByText('Connecting to vehicle research…')).toBeTruthy();
  });

  it('says the research could not be opened when the result is invalid', () => {
    render(
      <ChatVehicleResearchOverview
        call={call({ result: JSON.stringify({ id: 'not-a-uuid' }) })}
        actions={actions}
      />,
    );
    expect(
      screen.getByText(
        'Research could not be opened. Ask SpecSync to try again.',
      ),
    ).toBeTruthy();
  });

  it('opens the journal of the request the tool returned', () => {
    render(
      <ChatVehicleResearchOverview
        call={call({
          name: 'getVehicleResearch',
          result: JSON.stringify({ id: RESEARCH_ID }),
        })}
        actions={actions}
      />,
    );
    expect(screen.getByText(`research ${RESEARCH_ID}`)).toBeTruthy();
  });
});
