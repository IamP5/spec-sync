import { fireEvent, render, screen } from '@testing-library/react-native';

import type {
  IngestionClaim,
  IngestionConfigurationDraft,
} from '../../data/ingestion-contracts';
import { reviewDecisions } from '../review-decisions';
import { IngestionDecisionPane } from './ingestion-decision-pane';

function claim(overrides: Partial<IngestionClaim>): IngestionClaim {
  return {
    attributeCode: 'power',
    label: 'Power',
    unit: 'cv',
    rawValue: '250',
    rawUnit: 'cv',
    availability: null,
    listValue: null,
    qualifiers: {},
    lineStart: 2,
    lineEnd: 2,
    excerpt: '250 cv',
    locator: 'Page 1',
    value: 250,
    issues: [],
    ...overrides,
  };
}

const configuration: IngestionConfigurationDraft = {
  name: 'Limited',
  identityLineStart: 1,
  identityLineEnd: 1,
  identityExcerpt: 'Limited',
  warnings: [],
  claims: [
    claim({}),
    claim({ rawValue: '254', value: 254, excerpt: '254 cv (E100)' }),
  ],
};

describe('IngestionDecisionPane', () => {
  it('lets the reviewer pick one candidate of a conflict and read its lines', () => {
    const [decision] = reviewDecisions(
      configuration,
      undefined,
      new Set(),
      'en-US',
    );
    const handlers = {
      onChoose: jest.fn(),
      onClear: jest.fn(),
      onDefer: jest.fn(),
      onEvidence: jest.fn(),
    };
    render(
      <IngestionDecisionPane
        decision={decision!}
        configuration="Limited"
        status="pending"
        selectedIndex={undefined}
        reviewing
        {...handlers}
      />,
    );
    expect(screen.getByText('Choose a candidate')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Select 254 cv'));
    expect(handlers.onChoose).toHaveBeenCalledWith(1);
    expect(screen.queryByText('254 cv (E100)')).toBeNull();
    fireEvent.press(screen.getAllByLabelText('Lines 2–2')[1]!);
    expect(screen.getByText('254 cv (E100)')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Decide later'));
    expect(handlers.onDefer).toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Open the evidence'));
    expect(handlers.onEvidence).toHaveBeenCalled();
  });

  it('shows a published decision as final', () => {
    const [decision] = reviewDecisions(
      configuration,
      undefined,
      new Set([0]),
      'en-US',
    );
    render(
      <IngestionDecisionPane
        decision={decision!}
        configuration="Limited"
        status="published"
        selectedIndex={undefined}
        reviewing
        onChoose={jest.fn()}
        onClear={jest.fn()}
        onDefer={jest.fn()}
        onEvidence={jest.fn()}
      />,
    );
    expect(
      screen.getByText(
        'Published from this research. Changing it takes a new import.',
      ),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Select 254 cv')).toBeNull();
  });
});
