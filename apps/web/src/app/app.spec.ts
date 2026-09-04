import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should render the integration form', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('connected');
    expect(compiled.querySelector('input[name="name"]')).not.toBeNull();
  });

  it('should render a greeting returned by the API', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('input[name="name"]');
    const form = element.querySelector<HTMLFormElement>('form');
    expect(input).not.toBeNull();
    expect(form).not.toBeNull();
    if (!input || !form) {
      throw new Error('Expected the greeting form to render');
    }

    input.value = 'Tuba';
    input.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit'));

    const request = httpTesting.expectOne(
      (candidate) =>
        candidate.url === '/api/greeting' &&
        candidate.params.get('name') === 'Tuba',
    );
    request.flush({ message: 'Hello, Tuba, from api', hash: 'a1b2c3d4e5f6' });
    fixture.detectChanges();

    expect(element.querySelector('.response-body p')?.textContent).toContain(
      'Hello, Tuba, from api',
    );
    expect(element.querySelector('code')?.textContent).toContain(
      'a1b2c3d4e5f6',
    );
  });
});
