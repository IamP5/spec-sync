import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideChevronDown,
  lucideChevronLeft,
  lucideChevronRight,
} from '@ng-icons/lucide';

import {
  ZardPopoverComponent,
  ZardPopoverDirective,
} from '@/ui/components/popover';

import {
  type ChatEffortOption,
  type ChatModelOption,
  providerLabelOf,
} from '../../data/chat-model';

type PickerView = 'effort' | 'models';

const OPTION_SELECTOR = '[role="radio"]';
/** Below this width the panel spans the viewport instead of hanging off the pill. */
const NARROW_VIEWPORT_PX = 640;
const NARROW_MARGIN_PX = 16;
const CHECKED_OPTION_SELECTOR = '[role="radio"][aria-checked="true"]';

/**
 * The run options of the composer, in the style of ChatGPT: one compact pill
 * names the current reasoning effort (or the model when the service offers
 * no efforts) and opens a panel with the model row and the effort track.
 * The model row switches the panel to the model list; picking a model
 * returns to the effort track. Every option is a radio: arrow keys move the
 * selection inside a group, and the group keeps one tab stop.
 *
 * Dumb component: the page owns the catalog and the preferences and reacts
 * to `modelChange` / `effortChange`.
 */
@Component({
  selector: 'app-run-options-picker',
  imports: [NgIcon, ZardPopoverComponent, ZardPopoverDirective],
  viewProviders: [
    provideIcons({
      lucideCheck,
      lucideChevronDown,
      lucideChevronLeft,
      lucideChevronRight,
    }),
  ],
  template: `
    <button
      type="button"
      data-role="run-options"
      class="chat-run-options inline-flex min-h-8 max-w-64 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-foreground/80 transition-[background-color,color,transform] duration-150 ease-out hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none aria-expanded:bg-accent aria-expanded:text-foreground"
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
      @if (showModels() || !showEfforts()) {
        <span class="truncate" data-role="run-options-model">{{
          modelLabel()
        }}</span>
      }
      @if (showEfforts()) {
        @if (showModels()) {
          <span class="text-muted-foreground" aria-hidden="true">·</span>
        }
        <span
          class="shrink-0"
          [class.text-muted-foreground]="showModels()"
          data-role="run-options-effort"
          >{{ effortLabel() }}</span
        >
      }
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
        class="w-72 max-w-[calc(100vw-2rem)] gap-0.5 rounded-2xl p-1.5"
      >
        @if (view() === 'models') {
          <div
            class="animate-in duration-150 fade-in-0 slide-in-from-left-1 motion-reduce:animate-none"
          >
            <div class="flex items-center gap-1 px-1 py-0.5">
              @if (showEfforts()) {
                <button
                  type="button"
                  data-action="back"
                  class="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  aria-label="Back to reasoning effort"
                  (click)="showEffort()"
                >
                  <ng-icon name="lucideChevronLeft" aria-hidden="true" />
                </button>
              }
              <span class="text-xs font-medium text-muted-foreground"
                >Model</span
              >
            </div>
            <div
              role="radiogroup"
              tabindex="-1"
              aria-label="Model"
              data-role="model-select"
              (keydown)="onOptionKeydown($event)"
            >
              @for (group of modelGroups(); track group.label) {
                <div
                  class="px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
                  data-role="model-group"
                >
                  {{ group.label }}
                </div>
                @for (model of group.models; track model.id) {
                  @let checked = model.id === selectedModel();
                  <button
                    type="button"
                    role="radio"
                    data-role="model-option"
                    [attr.data-value]="model.id"
                    [attr.aria-checked]="checked"
                    [tabIndex]="checked ? 0 : -1"
                    class="flex min-h-10 w-full items-center justify-between gap-2 rounded-md px-2.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none aria-checked:font-medium"
                    (click)="pickModel(model.id)"
                  >
                    <span class="truncate">{{ model.label }}</span>
                    @if (checked) {
                      <ng-icon
                        name="lucideCheck"
                        class="size-4 shrink-0"
                        aria-hidden="true"
                      />
                    }
                  </button>
                }
              }
            </div>
          </div>
        } @else {
          <div
            class="animate-in duration-150 fade-in-0 slide-in-from-right-1 motion-reduce:animate-none"
          >
            @if (showModels()) {
              <button
                type="button"
                data-role="model-select"
                class="mx-auto flex max-w-full flex-col items-center rounded-lg px-3 py-1 transition-[background-color,transform] duration-150 ease-out hover:bg-accent focus-visible:bg-accent focus-visible:outline-none active:scale-[0.97] motion-reduce:transition-none"
                aria-haspopup="true"
                (click)="openModels()"
              >
                <span
                  class="flex max-w-full items-center gap-0.5 text-sm font-medium"
                >
                  <span class="truncate">{{
                    showEfforts() ? effortLabel() : modelLabel()
                  }}</span>
                  <ng-icon
                    name="lucideChevronRight"
                    class="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </span>
                @if (showEfforts()) {
                  <span
                    class="max-w-full truncate text-xs text-muted-foreground"
                    >{{ modelLabel() }}</span
                  >
                }
              </button>
            } @else if (showEfforts()) {
              <span class="mx-auto px-3 py-1 text-sm font-medium">{{
                effortLabel()
              }}</span>
            }
            @if (showEfforts()) {
              <div class="px-1 pt-1 pb-0.5" data-role="effort-select">
                <span class="sr-only" aria-live="polite"
                  >Reasoning effort: {{ effortLabel() }}</span
                >
                <div
                  role="radiogroup"
                  tabindex="-1"
                  aria-label="Reasoning effort"
                  class="chat-effort-track relative mt-0.5 h-6 touch-none select-none"
                  (keydown)="onOptionKeydown($event)"
                >
                  <span
                    class="pointer-events-none absolute inset-0 overflow-hidden rounded-full bg-foreground/10"
                    aria-hidden="true"
                  >
                    <span
                      class="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
                      [style.width]="fillWidth()"
                    ></span>
                  </span>
                  <span
                    class="chat-effort-thumb pointer-events-none absolute top-1/2 size-8 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_4px_rgb(0_0_0/35%)] transition-[left,transform] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
                    [style.left]="thumbLeft()"
                    aria-hidden="true"
                  ></span>
                  <div
                    class="relative flex h-full items-center justify-between"
                  >
                    @for (
                      effort of efforts();
                      track effort.id;
                      let i = $index
                    ) {
                      @let checked = effort.id === selectedEffort();
                      <button
                        type="button"
                        role="radio"
                        data-role="effort-option"
                        [attr.data-value]="effort.id"
                        [attr.aria-checked]="checked"
                        [attr.aria-label]="effort.label"
                        [tabIndex]="checked ? 0 : -1"
                        class="group flex size-8 shrink-0 items-center justify-center rounded-full transition-transform duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover focus-visible:outline-none active:scale-95 motion-reduce:transition-none"
                        (click)="pickEffort(effort.id)"
                      >
                        <span
                          class="block size-1 rounded-full transition-[transform,opacity] duration-150 ease-out group-hover:scale-[1.75] motion-reduce:transition-none"
                          [class]="
                            checked
                              ? 'opacity-0'
                              : i < selectedIndex()
                                ? 'bg-white/70'
                                : 'bg-foreground/45'
                          "
                          aria-hidden="true"
                        ></span>
                      </button>
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </z-popover>
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex min-w-0' },
})
export class RunOptionsPicker {
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly popover = viewChild.required(ZardPopoverDirective);

  /** Models the service offers; the model row only shows when there is a choice. */
  readonly models = input<ChatModelOption[]>([]);
  readonly selectedModel = input('');
  /** Reasoning efforts the service offers, in ascending order; the track only shows when there are any. */
  readonly efforts = input<ChatEffortOption[]>([]);
  readonly selectedEffort = input('');
  readonly disabled = input(false);

  readonly modelChange = output<string>();
  readonly effortChange = output<string>();

  protected readonly view = signal<PickerView>('effort');
  /** Mirrors the popover, for the chevron on the pill. */
  protected readonly open = signal(false);
  /**
   * Shift of the panel along the pill: zero on wide screens, and on phones the
   * distance that puts the viewport-wide panel one margin from the left edge.
   */
  protected readonly alignOffset = signal(0);

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

  protected readonly showModels = computed(() => this.models().length > 1);
  protected readonly showEfforts = computed(() => this.efforts().length > 0);
  protected readonly modelGroups = computed(() =>
    groupByProvider(this.models()),
  );
  protected readonly modelLabel = computed(
    () =>
      this.models().find((model) => model.id === this.selectedModel())?.label ??
      '',
  );
  protected readonly selectedIndex = computed(() =>
    this.efforts().findIndex((effort) => effort.id === this.selectedEffort()),
  );
  protected readonly effortLabel = computed(
    () => this.efforts()[this.selectedIndex()]?.label ?? '',
  );
  protected readonly triggerDescription = computed(() => {
    const parts: string[] = [];
    if (this.showEfforts())
      parts.push(`Reasoning effort: ${this.effortLabel()}`);
    if (this.showModels()) parts.push(`Model: ${this.modelLabel()}`);
    return parts.join('. ');
  });
  /** Position of the selected stop along the track, 0..1. */
  private readonly ratio = computed(() => {
    const stops = this.efforts().length;
    return stops < 2 ? 0 : Math.max(this.selectedIndex(), 0) / (stops - 1);
  });
  /**
   * The stops are 2rem wide and spread across the row, so their centres run
   * from 1rem to 100% - 1rem; the fill ends at the selected centre.
   */
  protected readonly fillWidth = computed(
    () => `calc(1rem + (100% - 2rem) * ${this.ratio()})`,
  );
  /** The 2rem thumb is centred on the same point. */
  protected readonly thumbLeft = computed(
    () => `calc((100% - 2rem) * ${this.ratio()})`,
  );

  protected onVisible(visible: boolean): void {
    this.open.set(visible);
    if (!visible) return;
    this.view.set(this.showEfforts() ? 'effort' : 'models');
    this.focusChecked();
  }

  protected showEffort(): void {
    this.view.set('effort');
    this.focusChecked();
  }

  protected openModels(): void {
    this.view.set('models');
    this.focusChecked();
  }

  protected pickModel(id: string): void {
    if (id !== this.selectedModel()) this.modelChange.emit(id);
    if (this.showEfforts()) {
      this.showEffort();
    } else {
      this.popover().hide();
    }
  }

  protected pickEffort(id: string): void {
    if (id !== this.selectedEffort()) this.effortChange.emit(id);
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

  private measureAlignment(view: Window): void {
    if (view.innerWidth >= NARROW_VIEWPORT_PX) {
      this.alignOffset.set(0);
      return;
    }
    const left = this.host.nativeElement.getBoundingClientRect().left;
    this.alignOffset.set(Math.round(NARROW_MARGIN_PX - left));
  }

  /** Move focus into the open panel, onto the checked option of the current view. */
  private focusChecked(): void {
    setTimeout(() => {
      const panel = this.document.querySelector<HTMLElement>(
        '[data-role="run-options-panel"]',
      );
      const target =
        panel?.querySelector<HTMLElement>(CHECKED_OPTION_SELECTOR) ??
        panel?.querySelector<HTMLElement>(OPTION_SELECTOR) ??
        panel?.querySelector<HTMLElement>('button');
      target?.focus();
    });
  }
}

function groupByProvider(models: ChatModelOption[]) {
  const groups = new Map<string, ChatModelOption[]>();
  for (const model of models) {
    const label = providerLabelOf(model.provider);
    groups.set(label, [...(groups.get(label) ?? []), model]);
  }
  return [...groups].map(([label, options]) => ({ label, models: options }));
}
