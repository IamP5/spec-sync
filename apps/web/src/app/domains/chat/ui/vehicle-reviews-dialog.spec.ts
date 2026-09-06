import { TestBed } from '@angular/core/testing';

import {
  Z_MODAL_DATA,
  ZardDialogRef,
  ZardDialogService,
} from '@/ui/components/dialog';

import { matrix } from '../../../testing/vehicle-fixtures';
import { VehicleReviewsDialog } from './vehicle-reviews-dialog';

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

describe('Vehicle review dialog', () => {
  const draft = vi.fn();
  const close = vi.fn();
  beforeEach(() => {
    draft.mockReset();
    close.mockReset();
    TestBed.configureTestingModule({
      imports: [VehicleReviewsDialog],
      providers: [
        {
          provide: Z_MODAL_DATA,
          useValue: { comparison: matrix, row: matrix.rows[0], draft },
        },
        { provide: ZardDialogRef, useValue: { close } },
      ],
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('activates the Zard focus trap and restores the trigger on close', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open reviews';
    document.body.append(trigger);
    trigger.focus();
    const ref = TestBed.inject(ZardDialogService).create({
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
    const fixture = TestBed.createComponent(VehicleReviewsDialog);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
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
    expect(close).toHaveBeenCalled();
    fixture.destroy();
    await Promise.resolve();
    expect(draft).toHaveBeenCalledWith(
      expect.stringContaining(modelReview.evidenceId),
    );
    expect(draft).not.toHaveBeenCalledWith(
      expect.stringContaining(modelReview.excerpt),
    );
  });
  it('shows failures rather than an empty corpus, then allows retry', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetch);
    const fixture = TestBed.createComponent(VehicleReviewsDialog);
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
