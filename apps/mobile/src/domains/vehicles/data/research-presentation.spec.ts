import {
  researchDraft,
  researchSnapshot,
} from '../../../testing/research-fixtures';
import { researchPeopleSchema } from './research-contracts';
import {
  researchCanReplay,
  researchClaimValue,
  researchComparisonRows,
  researchEvidenceConfigurations,
  researchIsReviewable,
  researchSelectedIndex,
  researchStage,
  researchStatus,
} from './research-presentation';

describe('Source-backed research presentation', () => {
  it('does not present failed extraction as a completed research', () => {
    const research = researchDraft();
    expect(
      researchStage({
        ...research,
        status: 'FAILED',
        stage: 'capture-source',
        configurations: [],
      }),
    ).toMatchObject({ index: 1, label: 'The research needs attention' });
    expect(
      researchStage({
        ...research,
        status: 'PROCESSING',
        stage: 'extract-abcdef0123456789abcd-configuration-0',
      }).index,
    ).toBe(2);
    expect(researchStage(research).index).toBe(3);
  });
  it('preserves competing observations and their conditions within each version', () => {
    const research = researchDraft();
    const first = research.configurations[0].claims[0];
    const alternative = {
      ...first,
      rawValue: '260',
      qualifiers: { fuel: 'ethanol' },
    };
    research.configurations[0].claims.push(alternative);
    const rows = researchComparisonRows(research);
    expect(rows[0].cells[0]).toEqual([first, alternative]);
    expect(rows[0].cells[1]).toHaveLength(1);
  });
  it.each([
    'javascript:alert(1)',
    'http://example.com',
    'https://user:password@example.com',
  ])('rejects unsafe external profile URL %s', (contactUrl) => {
    expect(
      researchPeopleSchema.safeParse({
        people: [{ name: 'Alice', contactUrl, isYou: false }],
        mine: null,
        hasMore: false,
      }).success,
    ).toBe(false);
  });

  it('describes retries and progress without exposing the interpretation hash', () => {
    expect(
      researchStatus(
        researchSnapshot({
          status: 'PROCESSING',
          attempts: 2,
          stage: 'extract-abcdef0123456789abcd-configuration-1',
        }),
      ),
    ).toBe('Retrying research · attempt 2 · Extracting specifications');
    expect(
      researchStatus(researchSnapshot({ status: 'QUEUED', attempts: 1 })),
    ).toBe('Retry queued after attempt 1');
    expect(
      researchStatus(researchSnapshot({ requestStatus: 'CANCELLED' })),
    ).toBe('Not following');
    expect(researchStatus(researchDraft())).toBe('Ready for review');
  });

  it('formats normalized values but keeps printed values when a claim has issues', () => {
    const claim = researchDraft().configurations[0]!.claims[0]!;
    expect(researchClaimValue(claim, 'en-US')).toBe('250 cv');
    expect(researchClaimValue({ ...claim, issues: [] }, 'en-US')).toBe(
      '250 cv',
    );
    expect(
      researchClaimValue({ ...claim, issues: [], value: 1234.567 }, 'en-US'),
    ).toBe('1,234.57 cv');
    expect(
      researchClaimValue({ ...claim, listValue: ['LED', 'Halogen'] }, 'en-US'),
    ).toBe('LED, Halogen');
  });

  it('focuses the evidence on one attribute of one version', () => {
    const research = researchDraft();
    expect(researchEvidenceConfigurations(research, null)).toHaveLength(2);
    const focused = researchEvidenceConfigurations(research, {
      configuration: 'XLT',
      attribute: 'power',
    });
    expect(focused.map((c) => c.name)).toEqual(['XLT']);
    expect(focused[0]!.claims).toHaveLength(1);
    expect(
      researchEvidenceConfigurations(research, {
        configuration: 'XLT',
        attribute: 'torque',
      })[0]!.claims,
    ).toEqual([]);
  });

  it('opens the journal on the requested version and offers review and replay only when complete', () => {
    const research = researchDraft();
    expect(
      researchSelectedIndex(
        {
          ...research,
          request: { ...research.request, configurations: [' xlt '] },
        },
        '',
      ),
    ).toBe(1);
    expect(researchSelectedIndex(research, 'XLT')).toBe(1);
    expect(researchCanReplay(research)).toBe(true);
    expect(researchIsReviewable(research)).toBe(true);
    const running = researchSnapshot();
    expect(researchCanReplay(running)).toBe(false);
    expect(researchIsReviewable(running)).toBe(false);
    expect(
      researchIsReviewable({ ...research, requestStatus: 'CANCELLED' }),
    ).toBe(false);
  });
});
