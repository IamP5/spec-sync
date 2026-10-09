import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  researchDraft,
  researchSnapshot,
} from '../../../../testing/research-fixtures';
import { ResearchEvidencePane } from './research-evidence-pane';
import { ResearchJournalPane } from './research-journal-pane';

function journal(research = researchDraft()) {
  const handlers = {
    onEvidence: jest.fn(),
    onPeople: jest.fn(),
    onRefresh: jest.fn(),
  };
  render(
    <ResearchJournalPane
      research={research}
      updating={false}
      error=""
      {...handlers}
    />,
  );
  return handlers;
}

describe('Research journal', () => {
  it('shows the requested vehicle, the step and the findings of the requested version', () => {
    journal();
    expect(screen.getByText('Getting to know Ford Ranger.')).toBeTruthy();
    expect(screen.getByText('Step 4 of 4')).toBeTruthy();
    expect(screen.getByText('Ready for review')).toBeTruthy();
    expect(screen.getByText('Ranger Limited')).toBeTruthy();
    expect(
      screen.getByText(
        '2 data points found · 2 versions · 0 observations without a match in the catalog',
      ),
    ).toBeTruthy();
  });

  it('passes the selected version and specification to the evidence', () => {
    const handlers = journal();
    fireEvent.press(screen.getByLabelText('Version XLT'));
    fireEvent.press(
      screen.getByRole('button', { name: '250 cv, open the source evidence' }),
    );
    expect(handlers.onEvidence).toHaveBeenCalledWith({
      configuration: 'XLT',
      attribute: 'power',
    });
    fireEvent.press(screen.getByLabelText('See evidence'));
    expect(handlers.onEvidence).toHaveBeenLastCalledWith(null);
    fireEvent.press(screen.getByLabelText('Interested people'));
    expect(handlers.onPeople).toHaveBeenCalled();
  });

  it('compares versions side by side', () => {
    journal();
    fireEvent.press(screen.getByLabelText('Compare versions'));
    expect(
      screen.getByText('Source data per version, still subject to review.'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Close comparison')).toBeTruthy();
  });

  it('offers a refresh only once the research stopped running', () => {
    journal(researchSnapshot());
    expect(screen.queryByLabelText('Refresh research')).toBeNull();
    expect(screen.getByText('Searching for sources')).toBeTruthy();
  });
});

describe('Research evidence', () => {
  it('offers reinterpretation of a completed saved source and stopping to follow', () => {
    const handlers = {
      onOpenSource: jest.fn(),
      onCancel: jest.fn(),
      onRefresh: jest.fn(),
      onReplay: jest.fn(),
    };
    render(
      <ResearchEvidencePane
        research={researchDraft()}
        focus={null}
        busy={false}
        replaying={false}
        updating={false}
        error=""
        {...handlers}
      />,
    );
    expect(screen.getByText('2 configurations from the source')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Reinterpret saved source'));
    expect(handlers.onReplay).toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Stop following'));
    expect(handlers.onCancel).toHaveBeenCalled();
    fireEvent.press(
      screen.getByRole('link', {
        name: 'Vehicle specification source, opens in the browser',
      }),
    );
    expect(handlers.onOpenSource).toHaveBeenCalledWith(
      'https://example.com/vehicle.pdf',
    );
  });
});
