import { BreakpointObserver } from '@angular/cdk/layout';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, map } from 'rxjs';

import { App } from './app';
import { FakeChatAgent, provideFakeChatAgent } from './testing/fake-chat-agent';

describe('App', () => {
  let viewport: BehaviorSubject<number>;
  beforeEach(async () => {
    localStorage.clear();
    viewport = new BehaviorSubject(1440);
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        {
          provide: BreakpointObserver,
          useValue: {
            observe: (queries: string | string[]) =>
              viewport.pipe(
                map((width) => {
                  const breakpoints = Object.fromEntries(
                    (Array.isArray(queries) ? queries : [queries]).map(
                      (query) => [
                        query,
                        query.includes('max-width')
                          ? width < 768
                          : width >= 1200,
                      ],
                    ),
                  );
                  return {
                    matches: Object.values(breakpoints).some(Boolean),
                    breakpoints,
                  };
                }),
              ),
          },
        },
        ...provideFakeChatAgent(new FakeChatAgent()),
      ],
    }).compileComponents();
  });

  it('renders the sidebar with the history and the routed page', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('app-thread-search')).not.toBeNull();
    expect(element.querySelector('[data-action="new-chat"]')).not.toBeNull();
    expect(
      element.querySelector('[data-role="history-empty"]')?.textContent,
    ).toContain('Your conversations will appear here.');
    expect(element.querySelector('main router-outlet')).not.toBeNull();
  });

  it('collapses on compact screens and expands again when there is room', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const sidebar = (fixture.nativeElement as HTMLElement).querySelector(
      'z-sidebar',
    ) as HTMLElement;
    expect(sidebar.getAttribute('data-state')).toBe('expanded');
    viewport.next(1000);
    await fixture.whenStable();
    expect(sidebar.getAttribute('data-state')).toBe('collapsed');
    viewport.next(1440);
    await fixture.whenStable();
    expect(sidebar.getAttribute('data-state')).toBe('expanded');
  });

  it('previews on mouse hover, dismisses on leave, and can be pinned open', async () => {
    viewport.next(1000);
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const sidebar = element.querySelector('z-sidebar') as HTMLElement;
    const hover = () =>
      sidebar.dispatchEvent(
        Object.assign(new Event('pointerenter'), { pointerType: 'mouse' }),
      );
    hover();
    await fixture.whenStable();
    expect(element.querySelector('.sidebar-preview')).not.toBeNull();
    expect(sidebar.getAttribute('data-state')).toBe('expanded');
    document.body.dispatchEvent(new Event('pointerover', { bubbles: true }));
    await fixture.whenStable();
    expect(sidebar.getAttribute('data-state')).toBe('collapsed');
    hover();
    await fixture.whenStable();
    sidebar
      .querySelector<HTMLButtonElement>('[data-slot="sidebar-trigger"]')
      ?.click();
    await fixture.whenStable();
    document.body.dispatchEvent(new Event('pointerover', { bubbles: true }));
    await fixture.whenStable();
    expect(element.querySelector('.sidebar-preview')).toBeNull();
    expect(sidebar.getAttribute('data-state')).toBe('expanded');
  });

  it('does not preview on touch and dismisses a mouse preview with Escape', async () => {
    viewport.next(1000);
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const sidebar = (fixture.nativeElement as HTMLElement).querySelector(
      'z-sidebar',
    ) as HTMLElement;
    sidebar.dispatchEvent(
      Object.assign(new Event('pointerenter'), { pointerType: 'touch' }),
    );
    await fixture.whenStable();
    expect(sidebar.getAttribute('data-state')).toBe('collapsed');
    sidebar.dispatchEvent(
      Object.assign(new Event('pointerenter'), { pointerType: 'mouse' }),
    );
    await fixture.whenStable();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await fixture.whenStable();
    expect(sidebar.getAttribute('data-state')).toBe('collapsed');
  });
});
