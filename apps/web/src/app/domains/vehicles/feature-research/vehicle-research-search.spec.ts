import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { provideFakeAuth, testSession } from '../../../testing/fake-auth';
import {
  RESEARCH_ID,
  researchDraft,
  researchSummary,
} from '../../../testing/research-fixtures';
import { VehicleResearchSearch } from './vehicle-research-search';

describe('VehicleResearchSearch', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideFakeAuth(),
      ],
    }),
  );

  it('recovers persisted requests and opens their current details without another agent call', async () => {
    const fixture = TestBed.createComponent(VehicleResearchSearch);
    const http = TestBed.inject(HttpTestingController);
    TestBed.tick();
    http
      .expectOne('/ai/chat/research')
      .flush({ requests: [researchSummary()] });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const history = element.querySelector<HTMLDetailsElement>(
      '[data-research-history]',
    );
    expect(history?.querySelector('summary')?.textContent).toContain(
      'Your vehicle research',
    );
    history?.setAttribute('open', '');
    history?.dispatchEvent(new Event('toggle'));
    TestBed.tick();
    http
      .expectOne('/ai/chat/research')
      .flush({ requests: [researchSummary()] });
    await fixture.whenStable();
    const request = history?.querySelector<HTMLDetailsElement>('details');
    request?.setAttribute('open', '');
    request?.dispatchEvent(new Event('toggle'));
    TestBed.tick();
    http.expectOne(`/ai/chat/research/${RESEARCH_ID}`).flush(researchDraft());
    await fixture.whenStable();
    expect(element.querySelectorAll('[data-configuration]')).toHaveLength(2);
    expect(element.textContent).toContain(
      'Dados extraídos da fonte, ainda não aceitos no catálogo.',
    );
    http.verify();
  });

  it('clears the old account list and cancels an in-flight refresh on a same-tick account switch', async () => {
    const fixture = TestBed.createComponent(VehicleResearchSearch);
    const http = TestBed.inject(HttpTestingController);
    TestBed.tick();
    const old = http.expectOne('/ai/chat/research');
    const generation = testSession().begin('bob');
    testSession().establish('bob', generation);
    TestBed.tick();
    expect(old.cancelled).toBe(true);
    http.expectOne('/ai/chat/research').flush({ requests: [] });
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Ford Ranger',
    );
    http.verify({ ignoreCancelled: true });
  });
});
