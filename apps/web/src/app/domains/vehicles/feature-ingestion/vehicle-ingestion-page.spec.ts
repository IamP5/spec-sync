import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CuratorSessionClient } from '../data/curator-session-client';
import { VehicleIngestionPage } from './vehicle-ingestion-page';

describe('Vehicle ingestion page', () => {
  async function setup(runId?: string) {
    await TestBed.configureTestingModule({
      imports: [VehicleIngestionPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(VehicleIngestionPage);
    fixture.componentRef.setInput('runId', runId);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('asks for the curator key once and shares it with the launch form and the list', async () => {
    const { fixture, element } = await setup();
    const input = element.querySelector<HTMLInputElement>('#curator-key')!;
    input.value = 'k'.repeat(40);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    element
      .querySelector<HTMLFormElement>('form[aria-label="Curator access"]')!
      .requestSubmit();
    await new Promise((resolve) => setTimeout(resolve));
    // The run list loads as soon as the key is known; answer it so the view settles.
    const http = TestBed.inject(HttpTestingController);
    for (const request of http.match(() => true)) {
      expect(request.request.headers.get('X-Ingestion-Key')).toBe(
        'k'.repeat(40),
      );
      request.flush({ result: [] });
    }
    await fixture.whenStable();
    expect(TestBed.inject(CuratorSessionClient).key()).toBe('k'.repeat(40));
    expect(element.querySelector('#curator-key')).toBeNull();
    expect(
      element.querySelector('app-vehicle-ingestion-launch-edit'),
    ).not.toBeNull();
    expect(
      element.querySelector('app-vehicle-ingestion-search'),
    ).not.toBeNull();
    expect(
      element.querySelector(
        'app-vehicle-ingestion-launch-edit input[type="password"]',
      ),
    ).toBeNull();
    element
      .querySelector<HTMLButtonElement>('[data-action="disconnect"]')!
      .click();
    await fixture.whenStable();
    expect(TestBed.inject(CuratorSessionClient).hasKey()).toBe(false);
  });

  it('shows one run when the URL names it', async () => {
    const { element } = await setup('00000000-0000-4000-8000-000000000001');
    expect(
      element.querySelector('app-vehicle-ingestion-run-detail'),
    ).not.toBeNull();
    expect(
      element.querySelector('app-vehicle-ingestion-launch-edit'),
    ).toBeNull();
  });
});
