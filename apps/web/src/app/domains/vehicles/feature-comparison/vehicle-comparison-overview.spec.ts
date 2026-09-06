import { BreakpointObserver } from '@angular/cdk/layout';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { matrix } from '../../../testing/vehicle-fixtures';
import { VehicleComparisonOverview } from './vehicle-comparison-overview';

describe('VehicleComparisonOverview mobile comparison', () => {
  it.each([true, false])(
    'opens a responsive reviews drawer (mobile: %s) and hands off after closing',
    async (mobile) => {
      TestBed.configureTestingModule({
        providers: [
          {
            provide: BreakpointObserver,
            useValue: {
              observe: () => of({ matches: mobile, breakpoints: {} }),
            },
          },
        ],
      });
      vi.stubGlobal('fetch', vi.fn());
      vi.mocked(fetch).mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              status: 'OK',
              message: '',
              projectionVersion: null,
              items: [
                {
                  id: matrix.configurations[0].id,
                  evidenceId: matrix.configurations[0].id,
                  title: 'Review fixture',
                  excerpt: 'Camera test',
                  scope: 'MODEL',
                  conditions: null,
                },
              ],
            }),
          ),
      );
      try {
        const fixture = TestBed.createComponent(VehicleComparisonOverview);
        fixture.componentRef.setInput('comparison', matrix);
        const questions = vi.fn();
        fixture.componentInstance.questionRequested.subscribe(questions);
        await fixture.whenStable();
        const trigger = (
          fixture.nativeElement as HTMLElement
        ).querySelector<HTMLButtonElement>(
          '[aria-label="Ver avaliações sobre Camera"]',
        )!;
        trigger.focus();
        trigger.click();
        await fixture.whenStable();
        const panel = document.querySelector<HTMLElement>('z-drawer-panel')!;
        expect(panel.getAttribute('data-placement')).toBe(
          mobile ? 'bottom' : 'right',
        );
        expect(panel.getAttribute('aria-labelledby')).toBeTruthy();
        expect(!!panel.querySelector('[data-slot="drawer-swipe-handle"]')).toBe(
          mobile,
        );
        panel
          .querySelector<HTMLButtonElement>(
            '[aria-label="Selecionar relato: Review fixture"]',
          )!
          .click();
        await fixture.whenStable();
        [...panel.querySelectorAll('button')]
          .find((b) => b.textContent?.includes('Levar ao chat'))!
          .click();
        expect(questions).not.toHaveBeenCalled();
        await new Promise((resolve) => setTimeout(resolve, 500));
        await fixture.whenStable();
        expect(document.querySelector('z-drawer-panel')).toBeNull();
        expect(document.activeElement).toBe(trigger);
        expect(questions).toHaveBeenCalledWith(
          expect.objectContaining({
            kind: 'reviews',
            observationIds: [matrix.configurations[0].id],
          }),
        );
        fixture.destroy();
      } finally {
        vi.unstubAllGlobals();
      }
    },
  );

  it('keeps each vehicle paired with its value when cells arrive out of order', async () => {
    const comparison = structuredClone(matrix);
    comparison.configurations.push({
      ...comparison.configurations[0],
      id: 'third-configuration',
      brand: 'Toyota',
      model: 'Hilux',
      name: 'SRX Plus',
    });
    const row = comparison.rows[0];
    row.cells[1].knowledgeStatus = 'NOT_REPORTED';
    row.cells.push({
      ...structuredClone(row.cells[0]),
      configurationId: 'third-configuration',
      knowledgeStatus: 'CONFLICTING',
    });
    row.cells.reverse();
    const fixture = TestBed.createComponent(VehicleComparisonOverview);
    fixture.componentRef.setInput('comparison', comparison);
    fixture.componentRef.setInput('questionsEnabled', false);
    await fixture.whenStable();

    const values = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '.comparison-value',
      ),
    );
    expect(values).toHaveLength(3);
    expect(
      values.map((value) => value.getAttribute('data-configuration-id')),
    ).toEqual(
      comparison.configurations.map((configuration) => configuration.id),
    );
    expect(values[0].textContent).toContain('Black');
    expect(values[0].textContent).toContain('Opcional');
    expect(values[0].textContent).toContain('Pacote: Tech');
    expect(values[1].textContent).toContain('Limited');
    expect(values[1].textContent).toContain('Não informado');
    expect(values[1].textContent).not.toContain('Opcional');
    expect(values[2].textContent).toContain('Hilux');
    expect(values[2].textContent).toContain('Dados divergentes');
    expect(values[0].querySelector('details')?.open).toBe(false);
    expect(values[0].querySelector('button')).toBeNull();
  });

  it('filters mobile specifications and resets both search and differences', async () => {
    const fixture = TestBed.createComponent(VehicleComparisonOverview);
    fixture.componentRef.setInput('comparison', matrix);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const search = element.querySelector<HTMLInputElement>('input')!;
    search.value = 'missing specification';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    element.querySelector<HTMLButtonElement>('[aria-pressed]')!.click();
    await fixture.whenStable();
    const mobile = element.querySelector('.comparison-mobile')!;
    expect(mobile.textContent).toContain('Nenhum item corresponde');
    expect(mobile.querySelectorAll('.comparison-spec')).toHaveLength(0);

    mobile.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    expect(search.value).toBe('');
    expect(
      element.querySelector('[aria-pressed]')?.getAttribute('aria-pressed'),
    ).toBe('false');
    expect(mobile.querySelectorAll('.comparison-spec')).toHaveLength(1);
    expect(mobile.querySelectorAll('.comparison-value')).toHaveLength(2);
  });
});
