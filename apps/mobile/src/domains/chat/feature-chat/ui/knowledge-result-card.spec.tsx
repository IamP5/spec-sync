import { fireEvent, render, screen } from '@testing-library/react-native';

import { knowledgeView } from '../../data/knowledge-result';
import { KnowledgeResultCard } from './knowledge-result-card';

function renderCard(name: string, result: unknown, complete = true) {
  const onOpenLink = jest.fn();
  render(
    <KnowledgeResultCard
      view={knowledgeView(name, complete, result)}
      onOpenLink={onOpenLink}
    />,
  );
  return onOpenLink;
}

describe('knowledge result quiet lines', () => {
  it('hides internal lookups that worked and surfaces the ones that failed', () => {
    expect(
      knowledgeView(
        'listComparisonAttributes',
        true,
        JSON.stringify({ status: 'OK', items: [{ code: 'power_max' }] }),
      ),
    ).toEqual({ kind: 'hidden' });
    expect(
      knowledgeView(
        'resolveComparisonConcepts',
        true,
        JSON.stringify({
          status: 'UNAVAILABLE',
          message: 'Graph retrieval failed or was cancelled.',
          items: [],
        }),
      ),
    ).toEqual({
      kind: 'quiet',
      title: 'Specification identification',
      line: 'Unavailable right now. Ask the assistant to try again.',
      warnings: [],
    });
  });

  it('distinguishes a pending call from an unusable result', () => {
    expect(
      knowledgeView('searchReviewEvidence', false, undefined),
    ).toMatchObject({
      kind: 'quiet',
      line: 'Retrieving information…',
    });
    expect(
      knowledgeView('searchReviewEvidence', true, '{broken'),
    ).toMatchObject({
      kind: 'quiet',
      line: 'No valid result returned.',
    });
    expect(
      knowledgeView('searchReviewEvidence', true, { status: 'OK', items: [] }),
    ).toMatchObject({ kind: 'quiet', line: 'No matching results.' });
  });

  it('does not describe a historical EMPTY payload as discovered links', () => {
    expect(
      knowledgeView('discoverVehicleContent', true, {
        status: 'EMPTY',
        items: [],
        message: 'External links discovered through Google grounding.',
      }),
    ).toMatchObject({
      kind: 'quiet',
      title: 'External content search',
      line: 'No external links found for this search.',
    });
  });
});

describe('KnowledgeResultCard', () => {
  it('shows source warnings and year clues without a verified model-year identity', () => {
    const onOpenLink = renderCard('discoverVehicleSpecificationSources', {
      status: 'OK',
      message: 'Official source candidates found.',
      warnings: [
        'Web search was unavailable; these candidates came from the official site.',
      ],
      items: [
        {
          title: 'F-150 specifications',
          url: 'https://www.ford.com.br/f150-2025.pdf',
          documentType: 'PDF',
          modelMatch: true,
          availability: 'OVERSIZE',
          byteLength: 12000000,
          yearHint: 2025,
          market: 'BR',
          modelYear: 2026,
          identityStatus: 'CONFIRMED',
        },
        {
          title: 'Brochure',
          url: 'javascript:alert(1)',
          modelMatch: false,
          availability: 'UNREACHABLE',
        },
      ],
    });
    expect(screen.getByText('Specification sources')).toBeTruthy();
    expect(screen.getByText(/Web search was unavailable/)).toBeTruthy();
    expect(
      screen.getByText(/Year mentioned in the title or URL: 2025/),
    ).toBeTruthy();
    expect(screen.getByText(/Model match is not confirmed/)).toBeTruthy();
    expect(
      screen.getByText(/Document exceeds the current reading limit/),
    ).toBeTruthy();
    expect(screen.getByText(/Source could not be reached/)).toBeTruthy();
    expect(screen.queryByText(/CONFIRMED/)).toBeNull();
    expect(screen.queryByText(/12000000/)).toBeNull();
    fireEvent.press(
      screen.getByLabelText('F-150 specifications (opens the browser)'),
    );
    expect(onOpenLink).toHaveBeenCalledWith(
      'https://www.ford.com.br/f150-2025.pdf',
    );
    // A script URL is not a link.
    expect(screen.queryByLabelText('Brochure (opens the browser)')).toBeNull();
    expect(screen.getByText('Brochure')).toBeTruthy();
  });

  it('keeps identity and excerpt for review evidence without discovery warnings', () => {
    renderCard('searchReviewEvidence', {
      status: 'OK',
      warnings: ['Discovery-only warning must not appear here.'],
      items: [
        {
          title: 'Reviewed evidence',
          market: 'BR',
          modelYear: 2026,
          identityStatus: 'CONFIRMED',
          excerpt: 'A reviewed source excerpt.',
        },
      ],
    });
    expect(screen.getByText('BR · 2026 · CONFIRMED')).toBeTruthy();
    expect(screen.getByText('A reviewed source excerpt.')).toBeTruthy();
    expect(screen.queryByText(/Discovery-only warning/)).toBeNull();
    expect(screen.queryByText(/has not been verified/)).toBeNull();
  });

  it('labels external specification sources', () => {
    renderCard('discoverVehicleSpecificationSources', {
      status: 'OK',
      items: [
        {
          title: 'Shark ficha técnica',
          url: 'https://www.webmotors.com.br/catalogo/byd/shark',
          sourceType: 'EXTERNAL_WEBSITE',
        },
      ],
    });
    expect(screen.getByText(/External site/)).toBeTruthy();
    expect(screen.queryByText('Manufacturer website')).toBeNull();
  });

  it('renders a failed lookup as one quiet line', () => {
    renderCard('resolveComparisonConcepts', {
      status: 'UNAVAILABLE',
      message: 'Graph retrieval failed or was cancelled.',
      items: [],
    });
    expect(screen.getByText(/Unavailable right now/)).toBeTruthy();
    expect(screen.queryByText(/Graph retrieval failed/)).toBeNull();
  });
});
