import { TestBed } from '@angular/core/testing';

import { KnowledgeResultCard } from './knowledge-result-card';

describe('KnowledgeResultCard specification discovery', () => {
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
    expect(element.textContent).toContain('Fontes oficiais de especificações');
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

  it('preserves the identity and excerpt presentation for review evidence', async () => {
    const fixture = TestBed.createComponent(KnowledgeResultCard);
    fixture.componentRef.setInput('toolCall', {
      name: 'searchReviewEvidence',
      status: 'complete',
      args: {},
      result: {
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
      },
    });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('BR');
    expect(element.textContent).toContain('2026');
    expect(element.textContent).toContain('CONFIRMED');
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
