import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { ZardDrawerService } from '@/ui/components/drawer';

import { matrix } from '../../../testing/vehicle-fixtures';
import { VehicleReviewsSearch } from './vehicle-reviews-search';

const modelReview = {
  id: 'b9e06761-a2e7-5ae5-b2ad-387e93829fb7',
  evidenceId: 'c9e06761-a2e7-5ae5-b2ad-387e93829fb7',
  title: 'Teste de estrada',
  excerpt: 'Trecho exato sobre a câmera.',
  scope: 'MODEL',
  mediaType: 'VIDEO',
  conditions: null,
  context: 'Contexto maior da avaliação.',
};

describe('Vehicle reviews', () => {
  const draft = vi.fn();
  beforeEach(() => {
    draft.mockReset();
    TestBed.configureTestingModule({
      imports: [VehicleReviewsSearch],
      providers: [provideHttpClient()],
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('activates the Zard focus trap and restores the trigger on close', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open reviews';
    document.body.append(trigger);
    trigger.focus();
    const ref = TestBed.inject(ZardDrawerService).create({
      zTitle: 'Review sources',
      zContent: 'Evidence context',
      zDuration: 0,
    });
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelectorAll('.cdk-focus-trap-anchor')).toHaveLength(2);
    ref.close();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.activeElement).toBe(trigger);
    expect(document.querySelectorAll('.cdk-focus-trap-anchor')).toHaveLength(0);
    trigger.remove();
  });

  it('deduplicates model evidence, keeps selection through filters and prepares a grounded chat draft', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              status: 'OK',
              message: '',
              projectionVersion: null,
              items: [modelReview],
            }),
          ),
      ),
    );
    const fixture = TestBed.createComponent(VehicleReviewsSearch);
    fixture.componentRef.setInput('context', {
      comparison: matrix,
      row: matrix.rows[0],
    });
    fixture.componentInstance.questionRequested.subscribe(draft);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('article')).toHaveLength(1);
    const filtersToggle =
      element.querySelector<HTMLButtonElement>('[aria-controls]')!;
    expect(filtersToggle.getAttribute('aria-expanded')).toBe('false');
    expect(
      element.querySelector(
        `[id="${filtersToggle.getAttribute('aria-controls')}"]`,
      ),
    ).not.toBeNull();
    filtersToggle.click();
    await fixture.whenStable();
    const vehicle = element.querySelector<HTMLSelectElement>(
      'select[aria-label="Veículo"]',
    )!;
    vehicle.value = matrix.configurations[1].id;
    vehicle.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    filtersToggle.click();
    await fixture.whenStable();
    expect(filtersToggle.getAttribute('aria-expanded')).toBe('false');
    expect(filtersToggle.textContent).toContain('(1)');
    expect(vehicle.value).toBe(matrix.configurations[1].id);
    expect(element.querySelectorAll('article')).toHaveLength(1);

    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.textContent).toContain('versão não confirmada');
    element
      .querySelector<HTMLButtonElement>(
        '[aria-label="Selecionar relato: Teste de estrada"]',
      )
      ?.click();
    const search = element.querySelector<HTMLInputElement>('input');
    if (!search) throw new Error('Search input missing');
    search.value = 'no-match';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(element.querySelectorAll('article')).toHaveLength(0);
    expect(
      element.querySelector('[aria-label="Relatos selecionados"]')?.textContent,
    ).toContain('Teste de estrada');
    const ask = [...element.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Levar ao chat'),
    );
    ask?.click();
    fixture.destroy();
    await Promise.resolve();
    expect(draft).toHaveBeenCalledWith({
      kind: 'reviews',
      attributeCode: matrix.rows[0].attribute.code,
      configurationIds: matrix.configurations.map(
        (configuration) => configuration.id,
      ),
      evidenceIds: [modelReview.evidenceId],
      observationIds: [modelReview.id],
    });
    expect(JSON.stringify(draft.mock.calls)).not.toContain(modelReview.excerpt);
  });
  it('cancels requests when a reviews instance is destroyed', async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            const signal = options.signal;
            if (!signal) throw new Error('Missing cancellation signal');
            signals.push(signal);
            signal.addEventListener(
              'abort',
              () => reject(new DOMException('Aborted', 'AbortError')),
              { once: true },
            );
          }),
      ),
    );
    const pending = TestBed.createComponent(VehicleReviewsSearch);
    pending.componentRef.setInput('context', {
      comparison: matrix,
      row: matrix.rows[0],
    });
    TestBed.tick();
    await Promise.resolve();
    expect(signals).toHaveLength(matrix.configurations.length);
    pending.destroy();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it('shows failures rather than an empty corpus, then allows retry', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetch);
    const fixture = TestBed.createComponent(VehicleReviewsSearch);
    fixture.componentRef.setInput('context', {
      comparison: matrix,
      row: matrix.rows[0],
    });
    fixture.componentInstance.questionRequested.subscribe(draft);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Não foi possível',
    );
    expect(element.textContent).not.toContain('Ainda não há avaliações');
    fetch.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            status: 'EMPTY',
            message: '',
            projectionVersion: null,
            items: [],
          }),
        ),
    );
    [...element.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Tentar novamente'))
      ?.click();
    await fixture.whenStable();
    expect(element.textContent).toContain('Ainda não há avaliações indexadas');
  });
});
