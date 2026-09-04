import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should render the shell with a theme toggle', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('nav')?.textContent).toContain('SpecSync');
    expect(element.querySelector('router-outlet')).not.toBeNull();
    expect(
      element.querySelector('button[aria-label*="Switch to"]'),
    ).not.toBeNull();
  });
});
