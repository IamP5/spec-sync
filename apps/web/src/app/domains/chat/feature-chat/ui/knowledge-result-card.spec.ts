import { TestBed } from '@angular/core/testing';

import { KnowledgeResultCard } from './knowledge-result-card';

describe('KnowledgeResultCard specification discovery', () => {
  it('replays the exact historical specification excerpt contract', async () => {
    const fixture = TestBed.createComponent(KnowledgeResultCard);
    fixture.componentRef.setInput('toolCall', {
      name: 'getEvidenceExcerpt',
      status: 'complete',
      args: {},
      result: {
        status: 'OK',
        message: 'Source evidence.',
        projectionVersion: 'v1',
        items: [
          {
            evidenceId: '00000000-0000-4000-8000-000000000002',
            title: 'Ranger brochure',
            excerpt: 'The source reports a braked towing limit.',
            locator: 'page 12',
            path: 'ranger.pdf',
            provenance: 'CURATED_NOTES',
            upstreamUrls: ['https://ford.com/ranger.pdf'],
          },
        ],
      },
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain(
      'The source reports a braked towing limit.',
    );
    expect(fixture.nativeElement.textContent).toContain('page 12');
  });

  it('replays historical review excerpts with attribution, conditions and video timing', async () => {
    const fixture = TestBed.createComponent(KnowledgeResultCard);
    fixture.componentRef.setInput('toolCall', {
      name: 'getEvidenceExcerpt',
      status: 'complete',
      args: {},
      result: {
        status: 'OK',
        message: 'Source evidence.',
        projectionVersion: 'v1',
        items: [
          {
            id: '00000000-0000-4000-8000-000000000001',
            evidenceId: '00000000-0000-4000-8000-000000000002',
            title: 'Independent road test',
            excerpt: 'The ride felt firm.',
            scope: 'MODEL',
            url: 'https://www.youtube.com/watch?v=example',
            startSeconds: 84,
            author: 'Review author',
            publishedOn: '2026-04-01',
            capturedOn: '2026-04-02',
            kind: 'OPINION',
            sentiment: 'NEGATIVE',
            conditions: ['unloaded', 'urban roads'],
            context: 'The reviewer drove an unloaded vehicle.',
          },
        ],
      },
    });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Review author');
    expect(element.textContent).toContain('Captured 2026-04-02');
    expect(element.textContent).toContain('Source sentiment: NEGATIVE');
    expect(element.textContent).toContain('unloaded; urban roads');
    expect(element.querySelector('details')?.textContent).toContain(
      'The reviewer drove an unloaded vehicle.',
    );
    expect(element.querySelector('a')?.href).toContain('t=84');
  });

  it('does not describe a historical EMPTY payload as discovered links', async () => {
    const fixture = TestBed.createComponent(KnowledgeResultCard);
    fixture.componentRef.setInput('toolCall', {
      name: 'discoverVehicleContent',
      status: 'complete',
      args: {},
      result: JSON.stringify({
        status: 'EMPTY',
        items: [],
        message: 'External links discovered through Google grounding.',
      }),
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain(
      'No external links found',
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'External links discovered',
    );
    expect(fixture.nativeElement.textContent).not.toContain('encontrados');
  });

  it('shows source warnings and title/URL year clues without presenting a verified model-year identity', async () => {
    const fixture = TestBed.createComponent(KnowledgeResultCard);
    fixture.componentRef.setInput('toolCall', {
      name: 'discoverVehicleSpecificationSources',
      status: 'complete',
      args: {},
      result: JSON.stringify({
        status: 'OK',
        message: 'Official source candidates found.',
        warnings: [
          'Web search was unavailable; these candidates came from the official site.',
        ],
        diagnostics: { pagesInspected: 2, pageFailures: 0, search: 'FAILED' },
        items: [
          {
            title: 'F-150 specifications',
            url: 'https://www.ford.com.br/f150-2025.pdf',
            documentType: 'PDF',
            applicability: 'UNVERIFIED',
            provenance: 'OFFICIAL_SITE',
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
            url: 'https://www.ford.com.br/brochure.pdf',
            documentType: 'PDF',
            applicability: 'UNVERIFIED',
            provenance: 'PAGE_LINK',
            modelMatch: false,
            availability: 'UNREACHABLE',
            byteLength: null,
            yearHint: null,
          },
        ],
      }),
    });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Fontes de especificações');
    expect(
      element.querySelector('[aria-label="Source discovery warnings"]')
        ?.textContent,
    ).toContain('Web search was unavailable');
    expect(element.textContent).toContain(
      'Year mentioned in the title or URL: 2025',
    );
    expect(element.textContent).toContain(
      'Model-year applicability is unverified',
    );
    expect(element.textContent).toContain(
      'Model match is not confirmed by the link text',
    );
    expect(element.textContent).toContain(
      'Document exceeds the current reading limit',
    );
    expect(element.textContent).toContain('Source could not be reached');
    expect(element.textContent).not.toContain('12000000');
    expect(element.textContent).not.toContain('OVERSIZE');
    expect(element.textContent).not.toContain('2026');
    expect(element.textContent).not.toContain('CONFIRMED');
    expect(element.textContent).not.toContain('OFFICIAL_SITE');
    expect(element.textContent).not.toContain('pagesInspected');
    const source = element.querySelector<HTMLAnchorElement>('a');
    expect(source?.href).toBe('https://www.ford.com.br/f150-2025.pdf');
    expect(source?.rel).toContain('noopener');
  });

  it('keeps legacy discovery payloads readable and explicitly unverified', async () => {
    const fixture = TestBed.createComponent(KnowledgeResultCard);
    fixture.componentRef.setInput('toolCall', {
      name: 'discoverVehicleSpecificationSources',
      status: 'complete',
      args: {},
      result: {
        status: 'OK',
        message: 'One source candidate found.',
        warnings: { legacy: 'An unknown field in an older payload.' },
        items: [
          {
            title: 'Official model page',
            url: 'https://www.ford.com.br/f150/',
            documentType: 'HTML',
          },
        ],
      },
    });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('a')?.textContent).toContain(
      'Official model page',
    );
    expect(element.textContent).toContain('Web page · not yet read');
    expect(element.textContent).toContain('model year has not been verified');
    expect(element.textContent).not.toContain(
      'Year mentioned in the title or URL',
    );
    expect(element.textContent).not.toContain('No valid result');
  });

  it('preserves declared applicability and excerpts without guessing identity from unrelated fields', async () => {
    const fixture = TestBed.createComponent(KnowledgeResultCard);
    fixture.componentRef.setInput('toolCall', {
      name: 'searchReviewEvidence',
      status: 'complete',
      args: {},
      result: {
        status: 'OK',
        message: 'Indexed review evidence.',
        projectionVersion: 'catalog/reviews',
        warnings: ['Discovery-only warning must not appear here.'],
        items: [
          {
            title: 'Reviewed evidence',
            id: '00000000-0000-4000-8000-000000000001',
            evidenceId: '00000000-0000-4000-8000-000000000002',
            scope: 'MODEL',
            market: 'BR',
            modelYear: 2026,
            identityStatus: 'CONFIRMED',
            excerpt: 'A reviewed source excerpt.',
          },
        ],
      },
    });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Model-level evidence');
    expect(element.textContent).not.toContain('CONFIRMED');
    expect(element.textContent).not.toContain('2026');
    expect(element.querySelector('blockquote')?.textContent).toContain(
      'A reviewed source excerpt.',
    );
    expect(element.textContent).not.toContain('Discovery-only warning');
    expect(element.textContent).not.toContain('has not been verified');
  });

  it('does not equate a readable exact-year link with verified applicability', async () => {
    const fixture = TestBed.createComponent(KnowledgeResultCard);
    fixture.componentRef.setInput('toolCall', {
      name: 'discoverVehicleSpecificationSources',
      status: 'complete',
      args: { modelYear: 2026 },
      result: {
        status: 'OK',
        items: [
          {
            title: 'Ram 1500 specifications',
            url: 'https://www.ram.com.br/1500-2026.pdf',
            documentType: 'PDF',
            applicability: 'UNVERIFIED',
            modelMatch: true,
            yearHint: 2026,
            availability: 'READABLE',
            byteLength: 5000,
          },
        ],
      },
    });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain(
      'Year mentioned in the title or URL: 2026',
    );
    expect(element.textContent).toContain(
      'Model-year applicability is unverified',
    );
    expect(element.textContent).not.toContain('READABLE');
    expect(element.textContent).not.toContain('5000');
  });
});

it('labels external specification sources without presenting them as manufacturer evidence', async () => {
  const fixture = TestBed.createComponent(KnowledgeResultCard);
  fixture.componentRef.setInput('toolCall', {
    name: 'discoverVehicleSpecificationSources',
    status: 'complete',
    args: {},
    result: JSON.stringify({
      status: 'OK',
      items: [
        {
          title: 'Shark ficha técnica',
          url: 'https://www.webmotors.com.br/catalogo/byd/shark',
          sourceType: 'EXTERNAL_WEBSITE',
          applicability: 'UNVERIFIED',
        },
      ],
    }),
  });
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  expect(element.textContent).toContain('Site externo');
  expect(element.textContent).not.toContain('Fontes oficiais');
  expect(element.querySelector('a')?.href).toBe(
    'https://www.webmotors.com.br/catalogo/byd/shark',
  );
});
