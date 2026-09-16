// PROTOTYPE — floating variant switcher. Throwaway; renders only in dev mode.
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { Router } from '@angular/router';

export const HOME_VARIANTS = [
  { key: 'current', name: 'Original' },
  { key: 'a', name: 'Spotlight grid' },
  { key: 'b', name: 'Velocity (WebGL)' },
  { key: 'c', name: 'Blue oval particles' },
  { key: 'd', name: 'Horizon road' },
  { key: 'e', name: 'A + D hybrid' },
] as const;

@Component({
  selector: 'app-prototype-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'hidden sm:contents',
    '(document:keydown)': 'onKeydown($event)',
  },
  template: `
    <div
      class="fixed bottom-3 left-1/2 z-50 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-col items-center gap-2 rounded-2xl border border-border bg-card/95 p-2 text-foreground shadow-lg backdrop-blur-xl"
    >
      @if (variant() === 'e') {
        <div class="flex gap-2 text-xs">
          <select
            #brandSelect
            [value]="brand()"
            (change)="setAppearance('brand', brandSelect.value)"
            aria-label="Brand color"
            i18n-aria-label
            class="min-h-9 rounded-lg border border-border bg-background px-2 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <option value="mixed" i18n>Blue + neutral</option>
            <option value="mono" i18n>Monochrome</option>
            <option value="blue" i18n>Ford blue</option>
          </select>
          <select
            #lockupSelect
            [value]="lockup()"
            (change)="setAppearance('lockup', lockupSelect.value)"
            aria-label="Brand layout"
            i18n-aria-label
            class="min-h-9 rounded-lg border border-border bg-background px-2 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <option value="inline" i18n>Side by side</option>
            <option value="stacked" i18n>Stacked</option>
          </select>
        </div>
      }
      <div class="flex items-center gap-1 font-mono text-xs">
        <button
          type="button"
          class="grid size-9 place-items-center rounded-full hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
          aria-label="Previous variant"
          (click)="go(-1)"
        >
          ←
        </button>
        <span class="min-w-40 px-1 text-center">
          {{ (current().key || '–').toUpperCase() }} · {{ current().name }}
        </span>
        <button
          type="button"
          class="grid size-9 place-items-center rounded-full hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
          aria-label="Next variant"
          (click)="go(1)"
        >
          →
        </button>
      </div>
    </div>
  `,
  imports: [],
})
export class PrototypeSwitcher {
  private readonly router = inject(Router);
  readonly variant = input<string>('e');
  readonly brand = input<string>('mono');
  readonly lockup = input<string>('inline');

  protected setAppearance(key: 'brand' | 'lockup', value: string): void {
    void this.router.navigate([], {
      queryParams: { [key]: value },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected readonly index = computed(() =>
    Math.max(
      0,
      HOME_VARIANTS.findIndex((v) => v.key === (this.variant() ?? '')),
    ),
  );
  protected readonly current = computed(() => HOME_VARIANTS[this.index()]);

  protected go(step: number): void {
    const next =
      HOME_VARIANTS[
        (this.index() + step + HOME_VARIANTS.length) % HOME_VARIANTS.length
      ];
    void this.router.navigate([], {
      queryParams: { variant: next.key || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (
      target?.closest('input, textarea, select, button, [contenteditable]') ||
      (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
    )
      return;
    event.preventDefault();
    this.go(event.key === 'ArrowLeft' ? -1 : 1);
  }
}
