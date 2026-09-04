import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { GreetingPage } from './greeting-page';

describe('GreetingPage', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GreetingPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should render the integration form', async () => {
    const fixture = TestBed.createComponent(GreetingPage);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('connected');
    expect(compiled.querySelector('input#name')).not.toBeNull();
  });

  it('should render a greeting returned by the API', async () => {
    const fixture = TestBed.createComponent(GreetingPage);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('input#name');
    const form = element.querySelector<HTMLFormElement>('form');
    expect(input).not.toBeNull();
    expect(form).not.toBeNull();
    if (!input || !form) {
      throw new Error('Expected the greeting form to render');
    }

    input.value = 'Tuba';
    input.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit'));
    // `submit` validates asynchronously before it calls the store; the
    // resource then issues the request on the next change detection.
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();

    const request = httpTesting.expectOne(
      (candidate) =>
        candidate.url === '/api/greeting' &&
        candidate.params.get('name') === 'Tuba',
    );
    request.flush({ message: 'Hello, Tuba, from api', hash: 'a1b2c3d4e5f6' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      element.querySelector('[data-slot="card-content"] p')?.textContent,
    ).toContain('Hello, Tuba, from api');
    expect(element.querySelector('code')?.textContent).toContain(
      'a1b2c3d4e5f6',
    );
  });

  it('should show a validation alert when the name is empty', () => {
    const fixture = TestBed.createComponent(GreetingPage);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    element.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Enter your name',
    );
  });
});
