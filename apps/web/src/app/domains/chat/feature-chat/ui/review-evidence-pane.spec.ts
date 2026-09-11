import { TestBed } from '@angular/core/testing';

import { reviewEvidenceResultSchema } from '../../data/knowledge-contracts';
import { knowledgeView } from '../../data/knowledge-view';
import { ReviewEvidencePane } from './review-evidence-pane';

describe('review evidence contract and native view', () => {
  it('preserves opinion scope and source timing while escaping source text and rejecting unsafe links', async () => {
    const data = reviewEvidenceResultSchema.parse({
      kind: 'reviews',
      status: 'OK',
      message: 'Indexed evidence.',
      projectionVersion: 'c1/r1',
      items: [
        {
          id: '00000000-0000-4000-8000-000000000001',
          evidenceId: '00000000-0000-4000-8000-000000000002',
          title: '<script>unsafe()</script>',
          excerpt: '<img src=x onerror=unsafe()>',
          scope: 'MODEL',
          conditions: ['unloaded', 'highway'],
          kind: 'OPINION',
          url: 'javascript:unsafe()',
          publishedOn: '2026-08-01',
          context: 'The complete passage.',
        },
      ],
    });
    const fixture = TestBed.createComponent(ReviewEvidencePane);
    fixture.componentRef.setInput('result', data);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('script, img, a')).toBeNull();
    expect(element.textContent).toContain('Model-level evidence');
    expect(element.textContent).toContain('unloaded; highway');
    expect(element.textContent).toContain('Published 2026-08-01');
    expect(element.querySelector('blockquote')?.textContent).toContain('<img');
  });

  it('does not infer a review layout from arbitrary matching fields', () => {
    expect(
      knowledgeView('searchReviewEvidence', {
        status: 'OK',
        items: [{ title: 'Link', excerpt: 'Text' }],
      }),
    ).toBeUndefined();
    expect(
      knowledgeView('unknownTool', {
        kind: 'reviews',
        status: 'OK',
        items: [],
      }),
    ).toBeUndefined();
  });

  it('presents a failed evidence retrieval without claiming evidence is absent', async () => {
    const fixture = TestBed.createComponent(ReviewEvidencePane);
    fixture.componentRef.setInput('result', {
      status: 'ERROR',
      message: 'The evidence service is unavailable.',
      retryable: true,
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain(
      'service is unavailable',
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'No matching indexed',
    );
  });
});
