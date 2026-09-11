import { OverlayContainer } from '@angular/cdk/overlay';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { provideFakeAuth, testSession } from '../../../testing/fake-auth';
import { RESEARCH_ID, researchDraft } from '../../../testing/research-fixtures';
import { VehicleResearchDetail } from './vehicle-research-detail';

const url = `/ai/chat/research/${RESEARCH_ID}`;
const empty = { people: [], mine: null, hasMore: false };
describe('Research journal drawers', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideFakeAuth(),
      ],
    }),
  );
  async function openResearch() {
    const fixture = TestBed.createComponent(VehicleResearchDetail);
    fixture.componentRef.setInput('requestId', RESEARCH_ID);
    TestBed.tick();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(url).flush(researchDraft());
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const click = (text: string, root = host) => {
      const button = [...root.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === text,
      );
      expect(button, text).toBeTruthy();
      button?.click();
      TestBed.tick();
    };
    return { fixture, http, host, overlay, click };
  }
  it('opens source evidence from the live snapshot without a new HTTP request or agent call', async () => {
    const { fixture, http, overlay, click } = await openResearch();
    click('See evidence');
    await fixture.whenStable();
    expect(overlay.textContent).toContain('Research evidence');
    expect(overlay.textContent).toContain('250');
    expect(
      overlay.querySelector('a[href="https://example.com/vehicle.pdf"]'),
    ).toBeTruthy();
    http.expectNone(() => true);
    testSession().invalidate();
    await fixture.whenStable();
    expect(overlay.textContent).not.toContain('250');
    http.verify();
  });
  it('passes the selected version and specification from the journal into the evidence drawer', async () => {
    const { fixture, http, host, overlay } = await openResearch();
    host.querySelector<HTMLButtonElement>('[data-claim-value] button')?.click();
    await fixture.whenStable();
    expect(overlay.querySelectorAll('[data-configuration]')).toHaveLength(1);
    expect(
      overlay
        .querySelector('[data-configuration]')
        ?.getAttribute('data-configuration'),
    ).toBe('Limited');
    expect(overlay.querySelector('[data-claim-value]')?.textContent).toContain(
      '250',
    );
    http.verify();
  });

  it('loads consented people only on opening, cancels on close and clears on account invalidation', async () => {
    const { fixture, http, overlay, click } = await openResearch();
    http.expectNone(`${url}/interests`);
    click('Interested people');
    const pending = http.expectOne(`${url}/interests`);
    fixture.detectChanges();
    TestBed.tick();
    expect(
      overlay.querySelector('[aria-label="Close research details"]'),
    ).toBeTruthy();
    overlay
      .querySelector<HTMLButtonElement>('[aria-label="Close research details"]')
      ?.click();
    TestBed.tick();
    await fixture.whenStable();
    expect(pending.cancelled).toBe(true);
    click('Interested people');
    http.expectOne(`${url}/interests`).flush({
      people: [
        {
          name: 'Opt-in Alice',
          contactUrl: 'https://example.com/alice',
          isYou: false,
        },
      ],
      mine: null,
      hasMore: false,
    });
    await fixture.whenStable();
    const link = overlay.querySelector<HTMLAnchorElement>(
      'a[href="https://example.com/alice"]',
    );
    expect(link?.rel).toContain('noreferrer');
    expect(overlay.textContent).toContain('Opt-in Alice');
    testSession().invalidate();
    await fixture.whenStable();
    expect(overlay.textContent).not.toContain('Opt-in Alice');
    http.verify({ ignoreCancelled: true });
  });
  it('requires deliberate consent and removes only the current user profile without another search', async () => {
    const { fixture, http, overlay, click } = await openResearch();
    click('Interested people');
    http.expectOne(`${url}/interests`).flush(empty);
    await fixture.whenStable();
    const inputs = overlay.querySelectorAll<HTMLInputElement>('input');
    inputs[0].value = 'Synthetic Alice';
    inputs[0].dispatchEvent(new Event('input'));
    inputs[1].value = 'https://example.com/alice';
    inputs[1].dispatchEvent(new Event('input'));
    TestBed.tick();
    expect(
      overlay.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.disabled,
    ).toBe(true);
    inputs[2].click();
    TestBed.tick();
    overlay
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { cancelable: true }));
    TestBed.tick();
    const save = http.expectOne(`${url}/interests`);
    expect(save.request.method).toBe('POST');
    expect(save.request.body).toEqual({
      visible: true,
      name: 'Synthetic Alice',
      contactUrl: 'https://example.com/alice',
    });
    const mine = {
      name: 'Synthetic Alice',
      contactUrl: 'https://example.com/alice',
      isYou: true,
    };
    save.flush({ people: [mine], mine, hasMore: false });
    await fixture.whenStable();
    click('Remove my profile', overlay);
    const remove = http.expectOne(`${url}/interests`);
    expect(remove.request.body).toEqual({ visible: false });
    remove.flush(empty);
    await fixture.whenStable();
    expect(overlay.textContent).toContain('Your profile was removed.');
    http.verify();
  });
});
