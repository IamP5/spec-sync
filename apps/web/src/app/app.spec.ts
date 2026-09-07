import { BreakpointObserver, MediaMatcher } from '@angular/cdk/layout';
import { provideHttpClient } from '@angular/common/http';
import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, map } from 'rxjs';

import { provideZard } from '@/ui/core';
import { EDarkModes, ZardDarkMode } from '@/ui/services';

import { AppLayoutOverview as App } from './shell/app-layout/app-layout-overview';
import { provideFakeAuth } from './testing/fake-auth';
import { FakeChatAgent, provideFakeChatAgent } from './testing/fake-chat-agent';
import { provideFakeUser } from './testing/fake-user';

describe('App', () => {
  let viewport: BehaviorSubject<number>;
  beforeEach(async () => {
    localStorage.clear();
    viewport = new BehaviorSubject(1440);
    await TestBed.configureTestingModule({
      deferBlockBehavior: DeferBlockBehavior.Playthrough,
      imports: [App],
      providers: [
        provideHttpClient(),
        provideFakeUser(),
        provideFakeAuth(),
        provideZard(),
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

  it('keeps browser colors in sync with saved, explicit, and system themes', async () => {
    const systemTheme = Object.assign(new EventTarget(), { matches: false });
    TestBed.overrideProvider(MediaMatcher, {
      useValue: { matchMedia: () => systemTheme },
    });
    localStorage.setItem('theme', 'dark');
    localStorage.setItem(
      'specsync.chat.preferences.v1',
      JSON.stringify({ theme: 'dark' }),
    );
    const theme = TestBed.inject(ZardDarkMode);
    theme.init();
    const fixture = TestBed.createComponent(App);
    const expectTheme = (scheme: string, color: string) => {
      expect(document.documentElement.style.colorScheme).toBe(scheme);
      expect(document.documentElement.classList.contains('dark')).toBe(
        scheme === 'dark',
      );
      expect(
        document
          .querySelector('meta[name="color-scheme"]')
          ?.getAttribute('content'),
      ).toBe(scheme);
      const colors = document.querySelectorAll('meta[name="theme-color"]');
      expect(colors).toHaveLength(1);
      expect(colors[0].getAttribute('content')).toBe(color);
    };

    await fixture.whenStable();
    expectTheme('dark', '#0f0f0f');
    theme.toggleTheme(EDarkModes.LIGHT);
    await fixture.whenStable();
    expectTheme('light', '#ffffff');
    theme.toggleTheme(EDarkModes.DARK);
    await fixture.whenStable();
    expectTheme('dark', '#0f0f0f');
    theme.toggleTheme(EDarkModes.SYSTEM);
    await fixture.whenStable();
    expectTheme('light', '#ffffff');
    systemTheme.matches = true;
    systemTheme.dispatchEvent(
      Object.assign(new Event('change'), { matches: true }),
    );
    await fixture.whenStable();
    expectTheme('dark', '#0f0f0f');
    theme.toggleTheme(EDarkModes.LIGHT);
    await fixture.whenStable();
    expectTheme('light', '#ffffff');
  });

  it('tracks the mobile keyboard viewport and cleans up its listeners', async () => {
    const visualViewport = Object.assign(new EventTarget(), {
      height: 780,
      offsetTop: 0,
      scale: 1,
    });
    vi.stubGlobal('visualViewport', visualViewport);
    viewport.next(390);
    try {
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      expect(element.style.getPropertyValue('--visual-viewport-height')).toBe(
        '780px',
      );
      visualViewport.height = 420;
      visualViewport.offsetTop = 24;
      visualViewport.dispatchEvent(new Event('resize'));
      await fixture.whenStable();
      expect(element.style.getPropertyValue('--visual-viewport-height')).toBe(
        '420px',
      );
      expect(element.style.getPropertyValue('--visual-viewport-top')).toBe(
        '24px',
      );
      expect(
        document.documentElement.style.getPropertyValue(
          '--visual-viewport-height',
        ),
      ).toBe('420px');
      expect(
        document.documentElement.style.getPropertyValue(
          '--visual-viewport-top',
        ),
      ).toBe('24px');
      visualViewport.scale = 2;
      visualViewport.height = 210;
      visualViewport.dispatchEvent(new Event('resize'));
      await fixture.whenStable();
      expect(element.style.getPropertyValue('--visual-viewport-height')).toBe(
        '420px',
      );
      viewport.next(1440);
      await fixture.whenStable();
      expect(element.style.getPropertyValue('--visual-viewport-height')).toBe(
        '',
      );
      expect(
        document.documentElement.style.getPropertyValue(
          '--visual-viewport-height',
        ),
      ).toBe('');
      expect(
        document.documentElement.style.getPropertyValue(
          '--visual-viewport-top',
        ),
      ).toBe('');
      visualViewport.scale = 1;
      visualViewport.dispatchEvent(new Event('resize'));
      await fixture.whenStable();
      expect(element.style.getPropertyValue('--visual-viewport-height')).toBe(
        '',
      );
    } finally {
      vi.unstubAllGlobals();
    }
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
