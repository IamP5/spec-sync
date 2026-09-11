import { TestBed } from '@angular/core/testing';

import { competitiveMatrix } from '../../../../testing/competitive-workspace-fixtures';
import { EvidenceGapsPane } from './evidence-gaps-pane';

describe('EvidenceGapsPane', () => {
  it('emits only the declared configuration/attribute gap and respects disabled actions', async () => {
    const fixture = TestBed.createComponent(EvidenceGapsPane),
      requested = vi.fn();
    const gap = {
      configurationId: competitiveMatrix.configurations[1].id,
      attributeCode: 'camera_360',
      knowledgeStatus: 'NOT_REPORTED',
      reason: 'No accepted evidence for this scope.',
      observationCount: 0,
    };
    fixture.componentRef.setInput('result', {
      status: 'OK',
      comparison: competitiveMatrix,
      items: [gap],
    });
    fixture.componentInstance.investigateRequested.subscribe(requested);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Toyota Hilux');
    expect(element.textContent).toContain('Not reported');
    element.querySelector('button')?.click();
    expect(requested).toHaveBeenCalledWith({
      configurationId: gap.configurationId,
      attributeCode: gap.attributeCode,
    });
    fixture.componentRef.setInput('enabled', false);
    await fixture.whenStable();
    expect(element.querySelector('button')?.disabled).toBe(true);
  });
});
