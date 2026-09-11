import { researchDraft } from '../../../testing/research-fixtures';
import { researchPeopleSchema } from './research-contracts';
import { researchComparisonRows, researchStage } from './research-presentation';

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
});
