import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { provideFakeAuth, testSession } from '../../../../testing/fake-auth';
import {
  RESEARCH_ID,
  researchDraft,
  reviewRun,
} from '../../../../testing/research-fixtures';
import { ChatVehicleResearchDetail } from './chat-vehicle-research-detail';

describe('Chat vehicle research renderer', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideFakeAuth(),
      ],
    }),
  );

  it.each(['researchVehicleSpecifications', 'getVehicleResearch'])(
    'reopens %s through the authenticated snapshot endpoint',
    async (name) => {
      const fixture = TestBed.createComponent(ChatVehicleResearchDetail);
      fixture.componentRef.setInput('toolCall', {
        name,
        status: 'complete',
        args: {},
        result: JSON.stringify({
          id: RESEARCH_ID,
          stage: 'Stale tool output must not be displayed',
        }),
      });
      TestBed.tick();
      const http = TestBed.inject(HttpTestingController);
      http.expectOne(`/ai/chat/research/${RESEARCH_ID}`).flush(researchDraft());
      // The snapshot lands after a task; the review request follows from its render.
      await new Promise((resolve) => setTimeout(resolve));
      TestBed.tick();
      http
        .expectOne(`/ai/chat/research/${RESEARCH_ID}/review`)
        .flush({ result: reviewRun() });
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      expect(element.textContent).toContain('Ready for review');
      expect(element.textContent).toContain('Review and publication');
      expect(element.textContent).not.toContain('Stale tool output');
      expect(element.textContent).not.toContain('curator key');
      testSession().invalidate();
      await fixture.whenStable();
      expect(element.textContent).toContain('Sign in to view');
      expect(element.textContent).not.toContain('250 cv');
      http.verify();
    },
  );

  it('cancels the detail request when a tool card is destroyed', () => {
    const fixture = TestBed.createComponent(ChatVehicleResearchDetail);
    fixture.componentRef.setInput('toolCall', {
      name: 'getVehicleResearch',
      status: 'complete',
      args: {},
      result: { id: RESEARCH_ID },
    });
    TestBed.tick();
    const http = TestBed.inject(HttpTestingController);
    const pending = http.expectOne(`/ai/chat/research/${RESEARCH_ID}`);
    fixture.destroy();
    expect(pending.cancelled).toBe(true);
    http.verify({ ignoreCancelled: true });
  });

  it('revalidates the request after a same-tick account switch instead of showing old data or remaining idle', async () => {
    const fixture = TestBed.createComponent(ChatVehicleResearchDetail);
    fixture.componentRef.setInput('toolCall', {
      name: 'getVehicleResearch',
      status: 'complete',
      args: {},
      result: { id: RESEARCH_ID },
    });
    const http = TestBed.inject(HttpTestingController);
    TestBed.tick();
    http.expectOne(`/ai/chat/research/${RESEARCH_ID}`).flush(researchDraft());
    // The snapshot lands after a task; the review request follows from its render.
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    http
      .expectOne(`/ai/chat/research/${RESEARCH_ID}/review`)
      .flush({ result: reviewRun() });
    await fixture.whenStable();
    const generation = testSession().begin('bob');
    testSession().establish('bob', generation);
    TestBed.tick();
    http
      .expectOne(`/ai/chat/research/${RESEARCH_ID}`)
      .flush({}, { status: 422, statusText: 'Unavailable' });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('may be unavailable to your account');
    expect(element.textContent).not.toContain('250 cv');
    http.verify();
  });
});
