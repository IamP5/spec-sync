import { fireEvent, render, screen } from '@testing-library/react-native';

import { RESEARCH_ID, reviewRun } from '../../../testing/research-fixtures';
import type { IngestionRun } from '../data/ingestion-contracts';
import { VehicleIngestionReviewDetail } from './vehicle-ingestion-review-detail';

jest.mock('../../../design-system/components/ui/skeleton', () => ({
  Skeleton: () => null,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

/** Limited's power is evidenced (pre-approved); XLT's is unverified. */
function run(): IngestionRun {
  const base = reviewRun();
  const draft = base.draft!;
  return {
    ...base,
    draft: {
      ...draft,
      configurations: draft.configurations.map((configuration, index) =>
        index === 0
          ? {
              ...configuration,
              claims: configuration.claims.map((claim) => ({
                ...claim,
                issues: [],
              })),
            }
          : configuration,
      ),
    },
  };
}

const mockStore = {
  run: run(),
  isLoading: false,
  loadFailed: false,
  publishPending: false,
  publishError: '',
  reload: jest.fn(),
  publish: jest.fn(),
};
jest.mock('./research-review-detail-store', () => ({
  useResearchReviewDetailStore: () => mockStore,
}));

function setup(open: boolean) {
  const handlers = {
    onOpenChange: jest.fn(),
    onEvidence: jest.fn(),
    onRunChanged: jest.fn(),
  };
  render(
    <VehicleIngestionReviewDetail
      researchId={RESEARCH_ID}
      open={open}
      {...handlers}
    />,
  );
  return handlers;
}

describe('Guided research review', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows only the summary strip until the reader opens the decisions', () => {
    const handlers = setup(false);
    expect(
      screen.getByText('1 selected · 1 pending · 0 published'),
    ).toBeTruthy();
    expect(screen.queryByText('Publication summary')).toBeNull();
    fireEvent.press(screen.getByLabelText('Review decisions, 1 pending'));
    expect(handlers.onOpenChange).toHaveBeenCalledWith(true);
  });

  it('acknowledges unverified evidence and asks for the evidence of a decision', () => {
    const handlers = setup(true);
    fireEvent.press(screen.getAllByLabelText('Next pending decision')[0]!);
    expect(screen.getByText('Decision 1 of 1 · XLT')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Acknowledge and keep pending'));
    expect(screen.getByText('Acknowledged')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Open the evidence'));
    expect(handlers.onEvidence).toHaveBeenCalledWith({
      configuration: 'XLT',
      attribute: 'power',
    });
  });

  it('requires the identity and a reason, then publishes only the selection', async () => {
    mockStore.publish.mockResolvedValue({
      ...run(),
      status: 'PUBLISHED',
    });
    const handlers = setup(true);
    fireEvent.press(screen.getByLabelText('Review the publication'));
    expect(screen.getByText('Publication summary')).toBeTruthy();
    const publish = screen.getByLabelText('Publish 1 specifications');
    expect(publish.props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'This source applies to Limited, exactly this model year',
      }),
    );
    fireEvent.changeText(
      screen.getByLabelText('Review reason'),
      ' Checked the brochure ',
    );
    fireEvent.press(screen.getByLabelText('Publish 1 specifications'));
    await screen.findByText('Continue with the pending decisions');
    expect(mockStore.publish).toHaveBeenCalledWith({
      draftHash: 'c'.repeat(64),
      baseRevision: 4,
      reason: 'Checked the brochure',
      configurations: [
        { configuration: 0, identityConfirmed: true, selectedClaims: [0] },
      ],
    });
    expect(handlers.onRunChanged).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PUBLISHED' }),
    );
  });
});
