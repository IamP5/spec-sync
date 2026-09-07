import { BreakpointObserver } from '@angular/cdk/layout';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { matrix } from '../../../testing/vehicle-fixtures';
import { VehicleComparisonOverview } from './vehicle-comparison-overview';

describe('VehicleComparisonOverview', () => {
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
    const element = fixture.nativeElement as HTMLElement;

    const legend = [...element.querySelectorAll('.comparison-legend li')];
    expect(legend.map((item) => item.textContent?.trim().charAt(0))).toEqual([
      '1',
      '2',
      '3',
    ]);
    const values = [...element.querySelectorAll('.comparison-value')];
    expect(values).toHaveLength(3);
    expect(
      values.map((value) => value.getAttribute('data-configuration-id')),
    ).toEqual(
      comparison.configurations.map((configuration) => configuration.id),
    );
    expect(values[0].textContent).toContain('Black');
    expect(values[0].textContent).toContain('Opcional');
    expect(values[1].textContent).toContain('Limited');
    expect(values[1].textContent).toContain('não informado');
    expect(values[1].textContent).not.toContain('Opcional');
    expect(values[2].textContent).toContain('SRX Plus');
    expect(values[2].textContent).toContain('Divergente');
    expect(element.textContent).toContain('difere');

    const details = element.querySelector('details')!;
    expect(details.open).toBe(false);
    const blocks = [...details.querySelectorAll('.comparison-detail')];
    expect(
      blocks.map((block) => block.getAttribute('data-configuration-id')),
    ).toEqual(
      comparison.configurations.map((configuration) => configuration.id),
    );
    expect(blocks[0].textContent).toContain('Pacote: Tech');
    expect(blocks[1].textContent).toContain('Não informado');
    expect(blocks[2].textContent).toContain('Dados divergentes');
    expect(details.querySelector('button')).toBeNull();
    fixture.destroy();
  });

  it('names a vehicle next to its values when its number is tapped', async () => {
    const fixture = TestBed.createComponent(VehicleComparisonOverview);
    fixture.componentRef.setInput('comparison', matrix);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const chip = element.querySelector<HTMLElement>(
      `.comparison-value[data-configuration-id="${matrix.configurations[1].id}"]`,
    )!;
    const number = chip.querySelector('button')!;
    expect(number.getAttribute('aria-pressed')).toBe('false');
    expect(number.textContent?.trim()).toBe('2');
    expect(number.getAttribute('title')).toBe('Ranger Limited');

    number.click();
    await fixture.whenStable();
    expect(number.getAttribute('aria-pressed')).toBe('true');
    expect(number.textContent).toContain('Ranger Limited');
    expect(
      element
        .querySelector('.comparison-legend button[aria-pressed="true"]')
        ?.textContent?.trim(),
    ).toBe('2');

    element
      .querySelector<HTMLButtonElement>('.comparison-legend button')!
      .click();
    await fixture.whenStable();
    const chips = [...element.querySelectorAll('.comparison-value button')];
    expect(chips.map((button) => button.getAttribute('aria-pressed'))).toEqual([
      'true',
      'true',
    ]);
    fixture.destroy();
  });

  it('hides the numbers for a single vehicle', async () => {
    const fixture = TestBed.createComponent(VehicleComparisonOverview);
    fixture.componentRef.setInput('comparison', {
      configurations: [matrix.configurations[0]],
      rows: matrix.rows.map((row) => ({ ...row, cells: [row.cells[0]] })),
    });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Especificações do veículo');
    expect(element.querySelector('.comparison-legend button')).toBeNull();
    expect(element.querySelector('.comparison-value button')).toBeNull();
    expect(element.textContent).not.toContain('Só diferenças');
    fixture.destroy();
  });

  it('filters specifications and resets both search and differences', async () => {
    const fixture = TestBed.createComponent(VehicleComparisonOverview);
    fixture.componentRef.setInput('comparison', matrix);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const search = element.querySelector<HTMLInputElement>('input')!;
    search.value = 'missing specification';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const differences = buttonNamed(element, 'Só diferenças');
    differences.click();
    await fixture.whenStable();
    expect(differences.getAttribute('aria-pressed')).toBe('true');
    expect(element.textContent).toContain('Nenhum item corresponde');
    expect(element.querySelectorAll('.comparison-spec')).toHaveLength(0);

    buttonNamed(element, 'Limpar filtros').click();
    await fixture.whenStable();
    expect(search.value).toBe('');
    expect(differences.getAttribute('aria-pressed')).toBe('false');
    expect(element.querySelectorAll('.comparison-spec')).toHaveLength(1);
    expect(element.querySelectorAll('.comparison-value')).toHaveLength(2);
    fixture.destroy();
  });
});

function buttonNamed(element: HTMLElement, name: string): HTMLButtonElement {
  const button = [
    ...element.querySelectorAll<HTMLButtonElement>('button'),
  ].find((candidate) => candidate.textContent?.includes(name));
  if (!button) throw new Error(`Button ${name} was not rendered`);
  return button;
}
