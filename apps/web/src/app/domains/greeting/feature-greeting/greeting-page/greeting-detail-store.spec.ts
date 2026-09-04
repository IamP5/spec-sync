import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { GreetingDetailStore } from './greeting-detail-store';

describe('GreetingDetailStore', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('stays idle until a name is loaded', () => {
    const store = TestBed.inject(GreetingDetailStore);
    TestBed.tick();

    expect(store.greetingStatus()).toBe('idle');
    httpTesting.expectNone('/api/greeting');
  });

  it('loads a greeting for the submitted name', async () => {
    const store = TestBed.inject(GreetingDetailStore);

    store.load('Tuba');
    TestBed.tick();

    const request = httpTesting.expectOne(
      (candidate) =>
        candidate.url === '/api/greeting' &&
        candidate.params.get('name') === 'Tuba',
    );
    request.flush({ message: 'Hello, Tuba, from api', hash: 'abc' });
    await settle();

    expect(store.greetingValue()?.message).toBe('Hello, Tuba, from api');
  });

  it('reloads when the same name is submitted again', async () => {
    const store = TestBed.inject(GreetingDetailStore);

    store.load('Tuba');
    TestBed.tick();
    httpTesting.expectOne('/api/greeting?name=Tuba').flush({
      message: 'first',
      hash: '1',
    });
    await settle();

    store.load('Tuba');
    TestBed.tick();
    httpTesting.expectOne('/api/greeting?name=Tuba').flush({
      message: 'second',
      hash: '2',
    });
    await settle();

    expect(store.greetingValue()?.hash).toBe('2');
  });
});

/** Flushes change detection and waits for the resource to process the response. */
async function settle(): Promise<void> {
  TestBed.tick();
  await TestBed.inject(ApplicationRef).whenStable();
}
