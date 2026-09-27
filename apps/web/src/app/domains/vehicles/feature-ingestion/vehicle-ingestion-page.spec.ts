import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { provideFakeAuth } from '../../../testing/fake-auth';
import { VehicleIngestionPage } from './vehicle-ingestion-page';

describe('Vehicle ingestion page', () => {
  // `whenStable` waits for in-flight requests, so it only runs once the
  // test has answered them; `pump` renders and lets resources send requests.
  async function pump() {
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
  }
  async function setup(runId?: string, authenticated = true) {
    await TestBed.configureTestingModule({
      imports: [VehicleIngestionPage],
      providers: [
        ...provideFakeAuth(authenticated),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(VehicleIngestionPage);
    fixture.componentRef.setInput('runId', runId);
    await pump();
    return {
      fixture,
      http: TestBed.inject(HttpTestingController),
      element: fixture.nativeElement as HTMLElement,
    };
  }
  const type = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const listRequest = (http: HttpTestingController) =>
    http.expectOne(
      (request) =>
        request.method === 'GET' && request.url === '/api/ingestions',
    );

  it('lists the imports for the signed-in user without asking for a curator key', async () => {
    const { fixture, http, element } = await setup();
    expect(element.querySelector('#curator-key')).toBeNull();
    expect(element.querySelector('input[type="password"]')).toBeNull();
    expect(element.querySelector('[data-action="disconnect"]')).toBeNull();
    const request = listRequest(http);
    expect(request.request.headers.has('X-Ingestion-Key')).toBe(false);
    request.flush({ result: [] });
    await fixture.whenStable();
    expect(element.textContent).toContain('No imports yet.');
    expect(
      element.querySelector('app-vehicle-ingestion-launch-edit'),
    ).not.toBeNull();
    http.verify();
  });

  it('explains a 403 as a missing curator role', async () => {
    const { fixture, http, element } = await setup();
    listRequest(http).flush(
      { title: 'Forbidden' },
      { status: 403, statusText: 'Forbidden' },
    );
    await fixture.whenStable();
    const alert = element.querySelector(
      'app-vehicle-ingestion-search [role="alert"]',
    );
    expect(alert?.textContent).toContain(
      'Your account does not have the curator role.',
    );
    expect(alert?.textContent).not.toContain('key');
  });

  it('explains a 401 as an expired session', async () => {
    const { fixture, http, element } = await setup();
    listRequest(http).flush(
      { title: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' },
    );
    await fixture.whenStable();
    expect(
      element.querySelector('app-vehicle-ingestion-search [role="alert"]')
        ?.textContent,
    ).toContain('Your session has expired. Sign in again and retry.');
  });

  it('shows the role message when the API refuses to start an import', async () => {
    const { fixture, http, element } = await setup();
    listRequest(http).flush({ result: [] });
    await fixture.whenStable();
    const form = element.querySelector('app-vehicle-ingestion-launch-edit')!;
    type(
      form.querySelector<HTMLInputElement>('input[type="url"]')!,
      'https://www.ford.com.br/ranger.pdf',
    );
    type(
      form.querySelector<HTMLInputElement>('input[placeholder="Ford"]')!,
      'Ford',
    );
    type(
      form.querySelector<HTMLInputElement>('input[placeholder="Ranger"]')!,
      'Ranger',
    );
    await fixture.whenStable();
    form.querySelector<HTMLButtonElement>('[data-action="start"]')!.click();
    await pump();
    const create = http.expectOne(
      (request) =>
        request.method === 'POST' && request.url === '/api/ingestions',
    );
    expect(create.request.headers.has('X-Ingestion-Key')).toBe(false);
    create.flush(
      { title: 'Forbidden' },
      { status: 403, statusText: 'Forbidden' },
    );
    await fixture.whenStable();
    expect(form.querySelector('[role="alert"]')?.textContent).toContain(
      'Your account does not have the curator role.',
    );
  });

  it('waits for a signed-in session before requesting anything', async () => {
    const { http, element } = await setup(undefined, false);
    expect(element.textContent).toContain('Sign in to list your imports.');
    http.expectNone('/api/ingestions');
  });

  it('shows one run when the URL names it', async () => {
    const { http, element } = await setup(
      '00000000-0000-4000-8000-000000000001',
    );
    expect(
      element.querySelector('app-vehicle-ingestion-run-detail'),
    ).not.toBeNull();
    expect(
      element.querySelector('app-vehicle-ingestion-launch-edit'),
    ).toBeNull();
    const request = http.expectOne(
      '/api/ingestions/00000000-0000-4000-8000-000000000001',
    );
    expect(request.request.headers.has('X-Ingestion-Key')).toBe(false);
  });
});
