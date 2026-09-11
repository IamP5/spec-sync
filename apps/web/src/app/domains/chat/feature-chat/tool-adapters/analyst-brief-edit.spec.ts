import { TestBed } from '@angular/core/testing';

import {
  competitiveMatrix,
  competitiveWorkspaceFixture,
} from '../../../../testing/competitive-workspace-fixtures';
import { AnalystBriefEdit } from './analyst-brief-edit';

describe('AnalystBriefEdit', () => {
  function setup() {
    const fixture = TestBed.createComponent(AnalystBriefEdit),
      workspace = competitiveWorkspaceFixture();
    fixture.componentRef.setInput('context', workspace.snapshot.plan.context);
    fixture.componentRef.setInput(
      'selectedConfigurations',
      competitiveMatrix.configurations,
    );
    fixture.componentRef.setInput(
      'availableAttributes',
      workspace.snapshot.availableAttributes,
    );
    return fixture;
  }
  it('keeps edits local until apply and emits an explicit scoped brief', async () => {
    const fixture = setup(),
      applied = vi.fn();
    fixture.componentInstance.briefApplied.subscribe(applied);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const objective = element.querySelector('textarea') as HTMLTextAreaElement;
    objective.value = 'Evaluate Ford equipment coverage';
    objective.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(applied).not.toHaveBeenCalled();
    const baseline = element.querySelector('select') as HTMLSelectElement;
    expect(baseline.textContent).toContain('Ranger');
    expect(baseline.textContent).not.toContain('Hilux');
    element
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(applied).toHaveBeenCalledWith(
      expect.objectContaining({
        objective: 'Evaluate Ford equipment coverage',
        market: 'BR',
        modelYear: 2026,
        baselineConfigurationId: competitiveMatrix.configurations[0].id,
        selectedConfigurationIds: competitiveMatrix.configurations.map(
          (vehicle) => vehicle.id,
        ),
        attributes: ['camera_360'],
        focusAreas: ['equipment'],
      }),
    );
  });
  it('blocks mismatched market/year selections and disabled submissions without losing draft text', async () => {
    const fixture = setup(),
      applied = vi.fn();
    fixture.componentInstance.briefApplied.subscribe(applied);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const market = element.querySelector(
      'input[placeholder="e.g. BR"]',
    ) as HTMLInputElement;
    market.value = 'US';
    market.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(element.textContent).toContain('must match the market');
    expect(
      element.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled,
    ).toBe(true);
    fixture.componentRef.setInput('enabled', false);
    await fixture.whenStable();
    fixture.componentInstance.requestApply();
    await fixture.whenStable();
    expect(applied).not.toHaveBeenCalled();
    expect(market.value).toBe('US');
  });
});
