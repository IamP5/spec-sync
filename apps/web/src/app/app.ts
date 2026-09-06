import { BreakpointObserver } from '@angular/cdk/layout';
import { DOCUMENT } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Meta } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

import {
  ZardSidebarComponent,
  ZardSidebarInsetComponent,
  ZardSidebarProviderComponent,
} from '@/ui/components/sidebar';
import { ZardDarkMode } from '@/ui/services';

import { ThreadSearch } from './domains/chat/feature-chat';

const WIDE_SCREEN = '(min-width: 1200px)';
const MOBILE_SCREEN = '(max-width: 767px)';

/** Responsive shell with an optional desktop hover preview and a mobile drawer. */
@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    ThreadSearch,
    ZardSidebarComponent,
    ZardSidebarInsetComponent,
    ZardSidebarProviderComponent,
  ],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block h-dvh overflow-hidden',
    '[style.--visual-viewport-height.px]': 'viewportHeight()',
    '[style.--visual-viewport-top.px]': 'viewportTop()',
    '(document:pointerover)': 'onOutsideInteraction($event)',
    '(document:pointerup)': 'onOutsideInteraction($event)',
    '(document:focusin)': 'onOutsideInteraction($event)',
    '(document:keydown.escape)': 'dismissPreview()',
  },
})
export class App {
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly document = inject(DOCUMENT);
  private readonly darkMode = inject(ZardDarkMode);
  private readonly meta = inject(Meta);
  private readonly sidebarElement = viewChild<
    ZardSidebarComponent,
    ElementRef<HTMLElement>
  >('sidebar', {
    read: ElementRef,
  });
  private readonly screen = toSignal(
    this.breakpoints
      .observe([WIDE_SCREEN, MOBILE_SCREEN])
      .pipe(
        map(({ breakpoints }) =>
          breakpoints[MOBILE_SCREEN]
            ? 'mobile'
            : breakpoints[WIDE_SCREEN]
              ? 'wide'
              : 'compact',
        ),
      ),
    { initialValue: 'wide' },
  );

  protected readonly viewportHeight = signal<number | null>(null);
  protected readonly viewportTop = signal(0);

  protected readonly pinned = linkedSignal(() => this.screen() === 'wide');
  protected readonly preview = linkedSignal({
    source: this.screen,
    computation: () => false,
  });
  protected readonly open = computed(() => this.pinned() || this.preview());

  constructor() {
    // Browser chrome must follow the resolved app theme, including system changes.
    afterRenderEffect(() => {
      const scheme = this.darkMode.themeMode();
      this.document.documentElement.style.colorScheme = scheme;
      this.meta.updateTag({ name: 'color-scheme', content: scheme });
      this.meta.updateTag({
        name: 'theme-color',
        content: scheme === 'dark' ? '#0f0f0f' : '#ffffff',
      });
    });

    // iOS keyboards resize the visual viewport without resizing CSS viewport units.
    afterRenderEffect((onCleanup) => {
      if (this.screen() !== 'mobile') {
        this.viewportHeight.set(null);
        this.viewportTop.set(0);
        return;
      }
      const viewport = this.document.defaultView?.visualViewport;
      if (!viewport) return;
      const measure = () => {
        // Leave pinch zoom under the browser's control.
        if (viewport.scale !== 1) return;
        this.viewportHeight.set(viewport.height);
        this.viewportTop.set(viewport.offsetTop);
        // CDK overlays live outside app-root and need the same keyboard bounds.
        this.document.documentElement.style.setProperty(
          '--visual-viewport-height',
          `${viewport.height}px`,
        );
        this.document.documentElement.style.setProperty(
          '--visual-viewport-top',
          `${viewport.offsetTop}px`,
        );
      };
      measure();
      viewport.addEventListener('resize', measure);
      viewport.addEventListener('scroll', measure);
      onCleanup(() => {
        viewport.removeEventListener('resize', measure);
        viewport.removeEventListener('scroll', measure);
        this.document.documentElement.style.removeProperty(
          '--visual-viewport-height',
        );
        this.document.documentElement.style.removeProperty(
          '--visual-viewport-top',
        );
      });
    });
  }

  protected togglePinned(): void {
    this.pinned.update((open) => !open);
    this.preview.set(false);
  }

  protected onPreview(event: PointerEvent): void {
    if (
      event.pointerType === 'mouse' &&
      this.screen() !== 'mobile' &&
      !this.pinned()
    ) {
      this.preview.set(true);
    }
  }

  protected onOutsideInteraction(event: Event): void {
    if (!this.preview() || !(event.target instanceof Element)) return;
    const sidebar = this.sidebarElement()?.nativeElement;
    if (
      sidebar?.contains(event.target) ||
      event.target.closest('.cdk-overlay-container')
    )
      return;
    // Keep a preview stable while editing a title, searching, or using an action menu.
    if (
      sidebar?.querySelector(
        '[aria-haspopup][aria-expanded="true"], input:focus',
      )
    )
      return;
    this.preview.set(false);
  }

  protected dismissPreview(): void {
    if (!this.preview()) return;
    const sidebar = this.sidebarElement()?.nativeElement;
    if (sidebar?.querySelector('[aria-haspopup][aria-expanded="true"]')) return;
    if (sidebar?.contains(this.document.activeElement)) {
      sidebar
        .querySelector<HTMLButtonElement>('[data-slot="sidebar-trigger"]')
        ?.focus();
    }
    this.preview.set(false);
  }
}
