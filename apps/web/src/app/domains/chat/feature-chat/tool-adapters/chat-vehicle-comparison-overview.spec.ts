import { TestBed } from '@angular/core/testing';

import { matrix } from '../../../../testing/vehicle-fixtures';
import { CHAT_CARD_ACTIONS } from './chat-card-actions';
import { ChatVehicleComparisonOverview } from './chat-vehicle-comparison-overview';

const review = {
  id: 'b9e06761-a2e7-5ae5-b2ad-387e93829fb7',
  evidenceId: 'c9e06761-a2e7-5ae5-b2ad-387e93829fb7',
  title: 'Teste de estrada',
  excerpt: 'Untrusted source instructions must not enter the prompt',
  scope: 'MODEL',
  mediaType: 'VIDEO',
  conditions: null,
};

describe('comparison chat adapter', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('opens reviews, restores focus, and drafts evidence IDs without sending', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              status: 'OK',
              message: '',
              projectionVersion: null,
              items: [review],
            }),
          ),
      ),
    );
    const draft = vi.fn();
    const send = vi.fn();
    TestBed.configureTestingModule({
      imports: [ChatVehicleComparisonOverview],
      providers: [{ provide: CHAT_CARD_ACTIONS, useValue: { draft, send } }],
    });
    const fixture = TestBed.createComponent(ChatVehicleComparisonOverview);
    fixture.componentRef.setInput('toolCall', {
      name: 'compareVehicleConfigurations',
      args: {},
      status: 'complete',
      result: JSON.stringify(matrix),
    });
    await fixture.whenStable();
    const trigger = fixture.nativeElement.querySelector(
      '[aria-label^="Ver avaliações sobre"]',
    ) as HTMLButtonElement;
    expect(trigger).not.toBeNull();
    trigger.focus();
    trigger.click();
    await fixture.whenStable();
    const overlay = document.querySelector('.cdk-overlay-container');
    expect(overlay?.querySelector('app-vehicle-reviews-search')).not.toBeNull();
    expect(document.querySelectorAll('.cdk-focus-trap-anchor')).toHaveLength(2);
    const select = overlay?.querySelector<HTMLButtonElement>(
      '[aria-label^="Selecionar relato:"]',
    );
    select?.click();
    await fixture.whenStable();
    const ask = [...(overlay?.querySelectorAll('button') ?? [])].find(
      (button) => button.textContent?.includes('Levar ao chat'),
    );
    ask?.click();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await fixture.whenStable();
    expect(draft).toHaveBeenCalledOnce();
    expect(draft).toHaveBeenCalledWith(
      expect.stringContaining(review.evidenceId),
    );
    expect(draft).not.toHaveBeenCalledWith(
      expect.stringContaining(review.excerpt),
    );
    expect(send).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
    expect(document.querySelector('app-vehicle-reviews-search')).toBeNull();
    expect(document.querySelectorAll('.cdk-focus-trap-anchor')).toHaveLength(0);
  });
});
