import { TestBed } from '@angular/core/testing';

import { matrix } from '../../../../testing/vehicle-fixtures';
import { TargetScenarioEdit } from './target-scenario-edit';

describe('TargetScenarioEdit', () => {
  it('requires an explicit finite analyst target and emits once on Apply', async () => {
    const fixture = TestBed.createComponent(TargetScenarioEdit),
      applied = vi.fn();
    fixture.componentRef.setInput('attributeCode', 'power_kw');
    fixture.componentRef.setInput('availableAttributes', [
      {
        ...matrix.rows[0].attribute,
        code: 'power_kw',
        label: 'Power',
        unit: 'kW',
        valueType: 'NUMBER',
      },
    ]);
    fixture.componentInstance.targetApplied.subscribe(applied);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement,
      input = element.querySelector('input') as HTMLInputElement,
      button = element.querySelector('button') as HTMLButtonElement;
    expect(input.value).toBe('');
    expect(button.disabled).toBe(true);
    input.value = '150';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(applied).not.toHaveBeenCalled();
    element
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(applied).toHaveBeenCalledWith({
      attributeCode: 'power_kw',
      targetValue: 150,
    });
    input.value = 'Infinity';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(button.disabled).toBe(true);
  });
  it('shows the source measure, qualifiers and exact excerpt without unsafe links or a vehicle ranking', async () => {
    const fixture = TestBed.createComponent(TargetScenarioEdit);
    const attribute = {
      ...matrix.rows[0].attribute,
      code: 'power_kw',
      label: 'Power',
      unit: 'kW',
      valueType: 'NUMBER' as const,
    };
    fixture.componentRef.setInput('attributeCode', 'power_kw');
    fixture.componentRef.setInput('targetValue', 150);
    fixture.componentRef.setInput('availableAttributes', [attribute]);
    fixture.componentRef.setInput('configurations', matrix.configurations);
    fixture.componentRef.setInput('result', {
      status: 'OK',
      assumption: 'USER_DEFINED_TARGET',
      attribute,
      targetValue: 150,
      items: [
        {
          configurationId: matrix.configurations[0].id,
          knowledgeStatus: 'KNOWN',
          observationId: matrix.configurations[0].id,
          value: 160,
          delta: 10,
          qualifiers: { rpm: 3000 },
          reason: null,
          evidence: [
            {
              id: 'source',
              title: 'Measured output',
              locator: 'page 4',
              excerpt: 'Power output measured at 3000 rpm.',
              upstreamUrls: [
                'javascript:alert(1)',
                'https://ford.com/specifications',
              ],
            },
          ],
        },
      ],
    });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Reported 160 kW · delta 10 kW');
    expect(element.textContent).toContain('Power output measured at 3000 rpm.');
    expect(element.textContent).toContain('3000');
    expect(element.querySelectorAll('a')).toHaveLength(1);
    expect(element.querySelector('a')?.getAttribute('href')).toBe(
      'https://ford.com/specifications',
    );
    expect(element.textContent).toContain('does not imply a better vehicle');
  });
});
