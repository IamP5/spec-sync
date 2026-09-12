import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  LOCALE_ID,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown } from '@ng-icons/lucide';

import {
  ZardPopoverComponent,
  ZardPopoverDirective,
} from '@/ui/components/popover';

import {
  type ChatMode,
  type ChatModeOption,
  DEFAULT_CHAT_MODE,
  messagesCovered,
  needsCostConfirmation,
} from '../../data/chat-model';
import { formatCredits, isBelowSmallestShown } from '../../data/credits';

type PickerView = 'options' | 'confirm';

const OPTION_SELECTOR = '[role="radio"]';
/** The one radio of a group that takes the tab stop. */
const FOCUSABLE_OPTION_SELECTOR = '[role="radio"][tabindex="0"]';
/** Below this width the panel spans the viewport instead of hanging off the pill. */
const NARROW_VIEWPORT_PX = 640;
const NARROW_MARGIN_PX = 16;
/** The stops of the track are 2rem wide; their centres run from 1rem to 100% - 1rem. */
const STOP_HALF_WIDTH_PX = 16;

/**
 * The run options of the composer, in the style of ChatGPT's thinking-time
 * control: one compact pill names the tier the assistant answers in
 * (`Balanced`) with a small level glyph, and opens a panel where the tiers sit
 * on a slider — one stop per tier, cheapest first, the name, cost and purpose
 * of the stop under the thumb above it.
 *
 * A tier is a map from role to model and reasoning effort owned by the AI
 * service; the panel only names it and what it costs, in credits per message,
 * with its multiplier against Balanced. Switching to an expensive tier on a
 * nearly empty wallet asks for confirmation inside the panel first, so nobody
 * discovers the price of Deep by running out.
 *
 * Every stop is a radio: arrow keys move the selection along the track, the
 * group keeps one tab stop, and the thumb can also be dragged.
 *
 * Dumb component: the page owns the catalog, the wallet and the preferences
 * and reacts to `modeChange`.
 */
@Component({
  selector: 'app-run-options-picker',
  imports: [NgIcon, ZardPopoverComponent, ZardPopoverDirective],
  viewProviders: [provideIcons({ lucideChevronDown })],
  template: `
    <button
      type="button"
      data-role="run-options"
      class="chat-run-options inline-flex min-h-8 max-w-64 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-foreground/80 transition-[background-color,color,transform] duration-150 ease-out hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none aria-expanded:bg-accent aria-expanded:text-foreground"
      zPopover
      [zContent]="panel"
      zPlacement="top"
      zAlign="start"
      zSideOffset="10"
      [zAlignOffset]="alignOffset()"
      [disabled]="disabled()"
      [attr.aria-label]="triggerDescription()"
      (zVisibleChange)="onVisible($event)"
    >
      @if (tiers().length > 1) {
        <span
          class="flex shrink-0 items-center gap-0.5"
          data-role="run-options-level"
          aria-hidden="true"
        >
          @for (tier of tiers(); track tier.id; let i = $index) {
            <span
              class="size-1 rounded-full transition-colors duration-150 motion-reduce:transition-none"
              [class]="
                i > trackIndex() ? 'bg-current opacity-25' : 'bg-current'
              "
            ></span>
          }
        </span>
      }
      <span class="truncate" data-role="run-options-mode">{{
        modeLabel()
      }}</span>
      <ng-icon
        name="lucideChevronDown"
        class="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ease-out motion-reduce:transition-none"
        [class.rotate-180]="open()"
        aria-hidden="true"
      />
    </button>

    <ng-template #panel>
      <z-popover
        data-role="run-options-panel"
        class="w-80 max-w-[calc(100vw-2rem)] gap-0.5 rounded-2xl p-1.5"
      >
        @switch (view()) {
          @case ('confirm') {
            <div
              role="group"
              data-role="mode-confirm"
              class="flex flex-col gap-2 p-2 animate-in duration-150 fade-in-0 motion-reduce:animate-none"
              aria-labelledby="run-options-confirm-title"
              aria-describedby="run-options-confirm-body"
              (keydown)="onConfirmKeydown($event)"
            >
              <h3
                class="text-sm font-medium"
                id="run-options-confirm-title"
                i18n
              >
                Switch to {{ pendingLabel() }}?
              </h3>
              <p
                class="text-xs text-muted-foreground"
                id="run-options-confirm-body"
                i18n
              >
                {{ pendingCost() }}. Your credits cover about
                {pendingMessages(), plural,
                  =1 {one message}
                  other {{{ pendingMessages() }} messages}
                }
                in this mode.
              </p>
              <div class="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  data-action="mode-cancel"
                  class="inline-flex min-h-8 items-center rounded-md px-3 text-xs font-medium hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  (click)="cancelSwitch()"
                  i18n
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-action="mode-confirm"
                  class="inline-flex min-h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  (click)="confirmSwitch()"
                  i18n
                >
                  Switch
                </button>
              </div>
            </div>
          }
          @default {
            <div
              class="animate-in duration-150 fade-in-0 slide-in-from-left-1 motion-reduce:animate-none"
            >
              <div class="px-1 pt-1.5 pb-1" data-role="mode-select">
                <div class="flex items-center gap-2 px-1.5">
                  <span
                    class="min-w-0 flex-1 truncate text-sm font-medium"
                    id="run-options-mode-title"
                    data-role="mode-title"
                    >{{ headline() }}</span
                  >
                  @if (headlineMultiplier()) {
                    <span
                      class="shrink-0 rounded-full bg-foreground/10 px-1.5 text-[11px] tabular-nums text-muted-foreground"
                      data-role="mode-multiplier"
                      aria-hidden="true"
                      >{{ headlineMultiplier() }}</span
                    >
                  }
                </div>
                <p
                  class="min-h-4 px-1.5 text-[11px] text-muted-foreground"
                  data-role="mode-detail"
                >
                  {{ headlineDetail() }}
                </p>
                <span class="sr-only" aria-live="polite" i18n
                  >Mode: {{ headline() }}</span
                >
                <div
                  role="radiogroup"
                  tabindex="-1"
                  aria-labelledby="run-options-mode-title"
                  data-role="mode-track"
                  class="chat-mode-track relative mt-2 h-6 touch-none select-none"
                  (keydown)="onOptionKeydown($event)"
                  (pointerdown)="onTrackPointerDown($event)"
                  (pointermove)="onTrackPointerMove($event)"
                  (pointerup)="onTrackPointerUp($event)"
                  (pointercancel)="onTrackPointerCancel($event)"
                >
                  <span
                    class="pointer-events-none absolute inset-0 overflow-hidden rounded-full bg-foreground/10"
                    aria-hidden="true"
                  >
                    <span
                      class="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width,opacity] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
                      [style.width]="fillWidth()"
                    ></span>
                  </span>
                  <span
                    class="chat-mode-thumb pointer-events-none absolute top-1/2 size-8 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_4px_rgb(0_0_0/35%)] transition-[left,transform] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
                    [class]="dragging() ? 'duration-0' : 'duration-300'"
                    [style.left]="thumbLeft()"
                    aria-hidden="true"
                  ></span>
                  <div
                    class="relative flex h-full items-center justify-between"
                  >
                    @for (tier of tiers(); track tier.id; let i = $index) {
                      @let checked = i === selectedIndex();
                      <button
                        type="button"
                        role="radio"
                        data-role="mode-option"
                        [attr.data-value]="tier.id"
                        [attr.aria-checked]="checked"
                        [attr.aria-label]="modeDescription(tier)"
                        [tabIndex]="i === trackIndex() ? 0 : -1"
                        class="group flex size-8 shrink-0 items-center justify-center rounded-full transition-transform duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover focus-visible:outline-none active:scale-95 motion-reduce:transition-none"
                        (click)="pickMode(tier.id)"
                      >
                        <span
                          class="block size-1 rounded-full transition-[transform,opacity] duration-150 ease-out group-hover:scale-[1.75] motion-reduce:transition-none"
                          [class]="
                            i === thumbIndex()
                              ? 'opacity-0'
                              : i < thumbIndex()
                                ? 'bg-white/70'
                                : 'bg-foreground/45'
                          "
                          aria-hidden="true"
                        ></span>
                      </button>
                    }
                  </div>
                </div>
                <div
                  class="mt-1.5 grid text-[11px] text-muted-foreground"
                  [style.grid-template-columns]="labelColumns()"
                  data-role="mode-labels"
                  aria-hidden="true"
                >
                  @for (tier of tiers(); track tier.id; let i = $index) {
                    <button
                      type="button"
                      tabindex="-1"
                      data-role="mode-label"
                      [attr.data-value]="tier.id"
                      class="truncate transition-colors duration-150 hover:text-foreground motion-reduce:transition-none"
                      [class]="labelAlignment(i)"
                      [class.font-medium]="i === thumbIndex()"
                      [class.text-foreground]="i === thumbIndex()"
                      (click)="pickMode(tier.id)"
                    >
                      {{ tier.label }}
                    </button>
                  }
                </div>
              </div>
            </div>
          }
        }
      </z-popover>
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex min-w-0' },
})
export class RunOptionsPicker {
  private readonly document = inject(DOCUMENT);
  private readonly locale = inject(LOCALE_ID);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly popover = viewChild.required(ZardPopoverDirective);

  /** Modes the service offers, cheapest first; the panel only shows when there is a choice. */
  readonly modes = input<ChatModeOption[]>([]);
  readonly selectedMode = input<ChatMode | ''>('');
  /** The mode the service answers in when nothing is picked; where the thumb rests. */
  readonly defaultMode = input<ChatMode | ''>('');
  /**
   * Credits the wallet still covers, in micro-credits, or nothing while
   * credits are disabled or unread. Only the confirm step reads it.
   */
  readonly availableCredits = input<number | undefined>(undefined);
  readonly disabled = input(false);

  readonly modeChange = output<ChatMode>();

  protected readonly view = signal<PickerView>('options');
  /** The mode waiting for a confirmation; nothing outside the confirm step. */
  private readonly pendingMode = signal<ChatModeOption | null>(null);
  /** Mirrors the popover, for the chevron on the pill. */
  protected readonly open = signal(false);
  /**
   * Shift of the panel along the pill: zero on wide screens, and on phones the
   * distance that puts the viewport-wide panel one margin from the left edge.
   */
  protected readonly alignOffset = signal(0);
  /** The stop under the pointer while the thumb is being dragged. */
  private readonly dragIndex = signal<number | null>(null);
  private dragPointerId: number | null = null;
  /** A drag just committed a stop: the click that may follow it is not a second pick. */
  private skipClick = false;

  constructor() {
    afterRenderEffect((onCleanup) => {
      const view = this.document.defaultView;
      if (!view) return;
      const measure = () => this.measureAlignment(view);
      measure();
      view.addEventListener('resize', measure);
      onCleanup(() => view.removeEventListener('resize', measure));
    });
  }

  /** The stops of the track, in the order the service lists them. */
  protected readonly tiers = computed(() => this.modes());

  private readonly mode = computed(() =>
    this.modes().find((mode) => mode.id === this.selectedMode()),
  );
  protected readonly modeLabel = computed(
    () => this.mode()?.label ?? labelOf(this.selectedMode()),
  );
  /** The stop that is the pick; -1 before the catalog lists it. */
  protected readonly selectedIndex = computed(() =>
    this.tiers().findIndex((tier) => tier.id === this.selectedMode()),
  );
  /**
   * The stop the thumb rests on: the pick, or the service default, so the
   * track never shows an empty state.
   */
  protected readonly trackIndex = computed(() => {
    const tiers = this.tiers();
    const selected = this.selectedIndex();
    if (selected >= 0) return selected;
    const fallback = this.defaultMode() || DEFAULT_CHAT_MODE;
    return Math.max(
      tiers.findIndex((tier) => tier.id === fallback),
      0,
    );
  });
  protected readonly dragging = computed(() => this.dragIndex() !== null);
  /** Where the thumb is drawn: under the pointer while dragging, else on `trackIndex`. */
  protected readonly thumbIndex = computed(
    () => this.dragIndex() ?? this.trackIndex(),
  );
  private readonly thumbTier = computed(
    (): ChatModeOption | undefined => this.tiers()[this.thumbIndex()],
  );
  /** What the panel names above the track: the tier under the thumb. */
  protected readonly headline = computed(() => this.thumbTier()?.label ?? '');
  protected readonly headlineDetail = computed(() => {
    const tier = this.thumbTier();
    return tier ? this.detail(tier) : '';
  });
  protected readonly headlineMultiplier = computed(() => {
    const tier = this.thumbTier();
    return tier ? this.multiplier(tier) : '';
  });
  protected readonly triggerDescription = computed(() => {
    const mode = this.modeLabel();
    return $localize`Mode: ${mode}:mode:`;
  });

  protected readonly pendingLabel = computed(
    () => this.pendingMode()?.label ?? '',
  );
  protected readonly pendingCost = computed(() =>
    costOf(this.pendingMode()?.estimatedCredits, this.locale),
  );
  protected readonly pendingMessages = computed(() =>
    messagesCovered(
      this.availableCredits() ?? 0,
      this.pendingMode()?.estimatedCredits,
    ),
  );

  /** Position of the thumb along the track, 0..1. */
  private readonly ratio = computed(() => {
    const stops = this.tiers().length;
    return stops < 2 ? 0 : Math.max(this.thumbIndex(), 0) / (stops - 1);
  });
  /**
   * The stops are 2rem wide and spread across the row, so their centres run
   * from 1rem to 100% - 1rem; the fill ends at the thumb's centre.
   */
  protected readonly fillWidth = computed(
    () => `calc(1rem + (100% - 2rem) * ${this.ratio()})`,
  );
  /** The 2rem thumb is centred on the same point. */
  protected readonly thumbLeft = computed(
    () => `calc((100% - 2rem) * ${this.ratio()})`,
  );
  protected readonly labelColumns = computed(
    () => `repeat(${Math.max(this.tiers().length, 1)}, minmax(0, 1fr))`,
  );

  /** The outer labels hug the edges, under the outer stops; the rest sit centred. */
  protected labelAlignment(index: number): string {
    if (index === 0) return 'text-left';
    if (index === this.tiers().length - 1) return 'text-right';
    return 'text-center';
  }

  /** What a mode costs per message, and what it is for; the cost comes first. */
  protected detail(mode: ChatModeOption): string {
    const cost = costOf(mode.estimatedCredits, this.locale);
    return [cost, mode.description].filter(Boolean).join(' · ');
  }

  /** How much more than Balanced a tier costs; nothing at or below it. */
  protected multiplier(mode: ChatModeOption): string {
    const relative = mode.relativeCost;
    return relative && relative > 1 ? `${relative}×` : '';
  }

  /** The stop's own sentence for a screen reader: the badge is decoration. */
  protected modeDescription(mode: ChatModeOption): string {
    const parts = [mode.label, this.detail(mode)].filter(Boolean);
    const relative = mode.relativeCost;
    if (relative && relative > 1) {
      parts.push($localize`${relative}:factor:× Balanced`);
    }
    return parts.join('. ');
  }

  protected onVisible(visible: boolean): void {
    this.open.set(visible);
    if (!visible) {
      this.pendingMode.set(null);
      this.endDrag();
      return;
    }
    this.showOptions();
  }

  protected showOptions(): void {
    this.pendingMode.set(null);
    this.view.set('options');
    this.focusChecked();
  }

  /**
   * Picks a mode, or asks first when the wallet covers fewer than twenty of
   * its replies. A click that follows a committed drag is the same pick.
   */
  protected pickMode(id: ChatMode): void {
    if (this.skipClick) {
      this.skipClick = false;
      return;
    }
    if (id === this.selectedMode()) return;
    const mode = this.modes().find((option) => option.id === id);
    if (needsCostConfirmation(mode, this.availableCredits())) {
      this.pendingMode.set(mode ?? null);
      this.view.set('confirm');
      // The safe option takes the focus, so Enter never spends more.
      this.focusIn('[data-action="mode-cancel"]');
      return;
    }
    this.modeChange.emit(id);
  }

  protected confirmSwitch(): void {
    const mode = this.pendingMode();
    if (mode) this.modeChange.emit(mode.id);
    this.showOptions();
  }

  /** Leaves the mode as it was; nothing was emitted while confirming. */
  protected cancelSwitch(): void {
    this.showOptions();
  }

  /** Escape means "not this mode", one level at a time: the panel stays open. */
  protected onConfirmKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    this.cancelSwitch();
  }

  /** Radio-group keyboard pattern: arrows move and select, Home/End jump. */
  protected onOptionKeydown(event: KeyboardEvent): void {
    const group = event.currentTarget as HTMLElement;
    const options = [
      ...group.querySelectorAll<HTMLButtonElement>(OPTION_SELECTOR),
    ];
    const current = options.findIndex((option) =>
      option.contains(event.target as Node),
    );
    if (current < 0) return;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (current + 1) % options.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (current - 1 + options.length) % options.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = options.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    options[next]?.focus();
    options[next]?.click();
  }

  /**
   * The thumb follows the pointer along the track and the stop it is released
   * on becomes the pick. The track captures the pointer, so a drag that leaves
   * it still ends here.
   */
  protected onTrackPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || this.disabled() || this.tiers().length < 2)
      return;
    const track = event.currentTarget as HTMLElement;
    try {
      track.setPointerCapture(event.pointerId);
    } catch {
      // Not a live pointer (synthetic events): the drag still works inside the track.
    }
    this.dragPointerId = event.pointerId;
    this.dragIndex.set(this.stopAt(track, event.clientX));
  }

  protected onTrackPointerMove(event: PointerEvent): void {
    if (event.pointerId !== this.dragPointerId) return;
    const track = event.currentTarget as HTMLElement;
    const index = this.stopAt(track, event.clientX);
    if (index !== this.dragIndex()) this.dragIndex.set(index);
  }

  protected onTrackPointerUp(event: PointerEvent): void {
    if (event.pointerId !== this.dragPointerId) return;
    const index = this.dragIndex();
    this.endDrag();
    const tier = index === null ? undefined : this.tiers()[index];
    if (!tier || index === this.selectedIndex()) return;
    this.pickMode(tier.id);
    // A tap on a stop also fires a click, in this same task.
    this.skipClick = true;
    setTimeout(() => (this.skipClick = false));
  }

  protected onTrackPointerCancel(event: PointerEvent): void {
    if (event.pointerId === this.dragPointerId) this.endDrag();
  }

  private endDrag(): void {
    this.dragPointerId = null;
    this.dragIndex.set(null);
  }

  /** The stop nearest to a viewport x on the track. */
  private stopAt(track: HTMLElement, clientX: number): number {
    const stops = this.tiers().length;
    const rect = track.getBoundingClientRect();
    const span = Math.max(rect.width - 2 * STOP_HALF_WIDTH_PX, 1);
    const ratio = (clientX - rect.left - STOP_HALF_WIDTH_PX) / span;
    return Math.round(Math.min(Math.max(ratio, 0), 1) * (stops - 1));
  }

  private measureAlignment(view: Window): void {
    if (view.innerWidth >= NARROW_VIEWPORT_PX) {
      this.alignOffset.set(0);
      return;
    }
    const left = this.host.nativeElement.getBoundingClientRect().left;
    this.alignOffset.set(Math.round(NARROW_MARGIN_PX - left));
  }

  /** Move focus into the open panel, onto the focusable option of the current view. */
  private focusChecked(): void {
    this.focusIn(FOCUSABLE_OPTION_SELECTOR, OPTION_SELECTOR, 'button');
  }

  private focusIn(...selectors: string[]): void {
    setTimeout(() => {
      const panel = this.document.querySelector<HTMLElement>(
        '[data-role="run-options-panel"]',
      );
      for (const selector of selectors) {
        const target = panel?.querySelector<HTMLElement>(selector);
        if (target) {
          target.focus();
          return;
        }
      }
    });
  }
}

/** A mode id as a label, for the pill before the catalog has loaded. */
function labelOf(mode: string): string {
  return mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : '';
}

/** `≈ 0.03 credits per message`, or nothing when the mode has no estimate. */
function costOf(
  estimatedCredits: number | null | undefined,
  locale: string,
): string {
  if (!estimatedCredits) {
    return '';
  }
  // "less than …" already reads as an approximation; anything else gets the sign.
  const formatted = formatCredits(estimatedCredits, locale);
  const amount = isBelowSmallestShown(estimatedCredits)
    ? formatted
    : `≈ ${formatted}`;
  return $localize`${amount}:amount: credits per message`;
}
