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
import {
  lucideCheck,
  lucideChevronDown,
  lucideChevronLeft,
  lucideChevronRight,
  lucideSettings2,
} from '@ng-icons/lucide';

import {
  ZardPopoverComponent,
  ZardPopoverDirective,
} from '@/ui/components/popover';

import {
  type ChatEffortOption,
  type ChatMode,
  type ChatModelOption,
  type ChatModeOption,
  type ChatRoleOption,
  messagesCovered,
  type ModelRole,
  needsCostConfirmation,
  type RoleModels,
  vendorLabelOf,
} from '../../data/chat-model';
import { formatCredits, isBelowSmallestShown } from '../../data/credits';

type PickerView = 'options' | 'advanced' | 'confirm';

/** What a role is set to when it has no override of its own. */
const FOLLOW_MODE = '';

const OPTION_SELECTOR = '[role="radio"]';
/** Below this width the panel spans the viewport instead of hanging off the pill. */
const NARROW_VIEWPORT_PX = 640;
const NARROW_MARGIN_PX = 16;
const CHECKED_OPTION_SELECTOR = '[role="radio"][aria-checked="true"]';

/**
 * The run options of the composer, in the style of ChatGPT: one compact pill
 * names the mode the assistant answers in (`Normal`, or `Auto · Normal` once
 * a run resolved one) and opens a panel with the four modes, the reasoning
 * effort track and an "Advanced" row.
 *
 * A mode is a map from role to model owned by the AI service; the panel only
 * names it and what it costs, in credits per message, with its multiplier
 * against Normal. "Advanced" opens the per-role overrides, each defaulting to
 * "Follow mode". Switching to an expensive mode on a nearly empty wallet asks
 * for confirmation inside the panel first, so nobody discovers the price of
 * Intelligent by running out.
 *
 * Every option is a radio: arrow keys move the selection inside a group, and
 * the group keeps one tab stop.
 *
 * Dumb component: the page owns the catalog, the wallet and the preferences
 * and reacts to `modeChange` / `effortChange` / `roleModelChange`.
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
      lucideSettings2,
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
      <span class="truncate" data-role="run-options-mode">{{
        modeLabel()
      }}</span>
      @if (resolvedLabel()) {
        <span class="text-muted-foreground" aria-hidden="true">·</span>
        <span
          class="shrink-0 text-muted-foreground"
          data-role="run-options-resolved"
          >{{ resolvedLabel() }}</span
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
          @case ('advanced') {
            <div
              class="animate-in duration-150 fade-in-0 slide-in-from-right-1 motion-reduce:animate-none"
            >
              <div class="flex items-center gap-1 px-1 py-0.5">
                <button
                  type="button"
                  data-action="back"
                  class="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  i18n-aria-label
                  aria-label="Back to modes"
                  (click)="showOptions()"
                >
                  <ng-icon name="lucideChevronLeft" aria-hidden="true" />
                </button>
                <span class="text-xs font-medium text-muted-foreground" i18n
                  >Advanced</span
                >
              </div>
              <div data-role="advanced-roles" class="max-h-80 overflow-y-auto">
                @for (role of roles(); track role.id) {
                  @let expanded = expandedRole() === role.id;
                  <button
                    type="button"
                    data-role="role-row"
                    [attr.data-value]="role.id"
                    [attr.aria-expanded]="expanded"
                    class="flex min-h-10 w-full items-center justify-between gap-2 rounded-md px-2.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                    (click)="toggleRole(role.id)"
                  >
                    <span class="truncate">{{ role.label }}</span>
                    <span
                      class="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground"
                    >
                      <span class="max-w-32 truncate">{{
                        roleValueLabel(role)
                      }}</span>
                      <ng-icon
                        name="lucideChevronRight"
                        class="size-4 transition-transform duration-150 ease-out motion-reduce:transition-none"
                        [class.rotate-90]="expanded"
                        aria-hidden="true"
                      />
                    </span>
                  </button>
                  @if (expanded) {
                    <div
                      role="radiogroup"
                      tabindex="-1"
                      data-role="role-models"
                      [attr.aria-label]="role.label"
                      class="mb-1 ml-2 border-l border-border pl-1"
                      (keydown)="onOptionKeydown($event)"
                    >
                      @for (option of roleOptions(role); track option.id) {
                        @let checked = option.id === roleModelOf(role.id);
                        <button
                          type="button"
                          role="radio"
                          data-role="role-model-option"
                          [attr.data-value]="option.id"
                          [attr.aria-checked]="checked"
                          [tabIndex]="checked ? 0 : -1"
                          class="flex min-h-9 w-full items-center justify-between gap-2 rounded-md px-2.5 text-left text-xs hover:bg-accent focus-visible:bg-accent focus-visible:outline-none aria-checked:font-medium"
                          (click)="pickRoleModel(role.id, option.id)"
                        >
                          <span class="truncate">{{ option.label }}</span>
                          @if (checked) {
                            <ng-icon
                              name="lucideCheck"
                              class="size-3.5 shrink-0"
                              aria-hidden="true"
                            />
                          }
                        </button>
                      }
                    </div>
                  }
                }
              </div>
            </div>
          }
          @default {
            <div
              class="animate-in duration-150 fade-in-0 slide-in-from-left-1 motion-reduce:animate-none"
            >
              @if (showModes()) {
                <div
                  role="radiogroup"
                  tabindex="-1"
                  i18n-aria-label
                  aria-label="Mode"
                  data-role="mode-select"
                  (keydown)="onOptionKeydown($event)"
                >
                  @for (mode of modes(); track mode.id) {
                    @let checked = mode.id === selectedMode();
                    <button
                      type="button"
                      role="radio"
                      data-role="mode-option"
                      [attr.data-value]="mode.id"
                      [attr.aria-checked]="checked"
                      [attr.aria-label]="modeDescription(mode)"
                      [tabIndex]="checked ? 0 : -1"
                      class="flex w-full flex-col gap-0.5 rounded-md px-2.5 py-1.5 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none aria-checked:bg-accent"
                      (click)="pickMode(mode.id)"
                    >
                      <span class="flex w-full items-center gap-2">
                        <span
                          class="min-w-0 flex-1 truncate text-sm aria-checked:font-medium"
                          [class.font-medium]="checked"
                          >{{ mode.label }}</span
                        >
                        @if (multiplier(mode)) {
                          <span
                            class="shrink-0 rounded-full bg-foreground/10 px-1.5 text-[11px] tabular-nums text-muted-foreground"
                            data-role="mode-multiplier"
                            aria-hidden="true"
                            >{{ multiplier(mode) }}</span
                          >
                        }
                        @if (checked) {
                          <ng-icon
                            name="lucideCheck"
                            class="size-4 shrink-0"
                            aria-hidden="true"
                          />
                        }
                      </span>
                      <span
                        class="truncate text-[11px] text-muted-foreground"
                        data-role="mode-detail"
                        >{{ detail(mode) }}</span
                      >
                    </button>
                  }
                </div>
              }
              @if (showEfforts()) {
                <div class="px-1 pt-1 pb-0.5" data-role="effort-select">
                  <span
                    class="px-1.5 text-[11px] font-medium text-muted-foreground"
                    id="run-options-effort-label"
                    i18n
                    >Reasoning effort</span
                  >
                  <span class="sr-only" aria-live="polite" i18n
                    >Reasoning effort: {{ effortLabel() }}</span
                  >
                  <div
                    role="radiogroup"
                    tabindex="-1"
                    aria-labelledby="run-options-effort-label"
                    class="chat-effort-track relative mt-1 h-6 touch-none select-none"
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
              @if (showAdvanced()) {
                <button
                  type="button"
                  data-role="advanced-open"
                  class="mt-0.5 flex min-h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:outline-none"
                  aria-haspopup="true"
                  (click)="showAdvancedRoles()"
                >
                  <ng-icon
                    name="lucideSettings2"
                    class="size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span class="flex-1" i18n>Advanced</span>
                  <ng-icon
                    name="lucideChevronRight"
                    class="size-4 shrink-0"
                    aria-hidden="true"
                  />
                </button>
              }
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
  /** What a role reads as while it has no override of its own. */
  protected readonly followModeLabel = $localize`Follow mode`;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly popover = viewChild.required(ZardPopoverDirective);

  /** Modes the service offers, cheapest first; the list only shows when there is a choice. */
  readonly modes = input<ChatModeOption[]>([]);
  readonly selectedMode = input<ChatMode | ''>('');
  /** The mode auto resolved to for the last run; the pill reads `Auto · Normal`. */
  readonly resolvedMode = input<ChatMode | null>(null);
  /** Reasoning efforts the service offers, in ascending order; the track only shows when there are any. */
  readonly efforts = input<ChatEffortOption[]>([]);
  readonly selectedEffort = input('');
  /** Roles the advanced selector may override, and the models it may offer. */
  readonly roles = input<ChatRoleOption[]>([]);
  readonly models = input<ChatModelOption[]>([]);
  readonly roleModels = input<RoleModels>({});
  /**
   * Credits the wallet still covers, in micro-credits, or nothing while
   * credits are disabled or unread. Only the confirm step reads it.
   */
  readonly availableCredits = input<number | undefined>(undefined);
  readonly disabled = input(false);

  readonly modeChange = output<ChatMode>();
  readonly effortChange = output<string>();
  readonly roleModelChange = output<{ role: ModelRole; modelId: string }>();

  protected readonly view = signal<PickerView>('options');
  /** The role whose model list is expanded inside the advanced view, if any. */
  protected readonly expandedRole = signal<ModelRole | null>(null);
  /** The mode waiting for a confirmation; nothing outside the confirm step. */
  private readonly pendingMode = signal<ChatModeOption | null>(null);
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

  protected readonly showModes = computed(() => this.modes().length > 1);
  protected readonly showEfforts = computed(() => this.efforts().length > 0);
  protected readonly showAdvanced = computed(
    () => this.roles().length > 0 && this.models().length > 0,
  );

  private readonly mode = computed(() =>
    this.modes().find((mode) => mode.id === this.selectedMode()),
  );
  protected readonly modeLabel = computed(
    () => this.mode()?.label ?? labelOf(this.selectedMode()),
  );
  /** The mode auto settled on, named only while auto is the pick. */
  protected readonly resolvedLabel = computed(() => {
    const resolved = this.resolvedMode();
    if (this.selectedMode() !== 'auto' || !resolved || resolved === 'auto') {
      return '';
    }
    return (
      this.modes().find((mode) => mode.id === resolved)?.label ??
      labelOf(resolved)
    );
  });
  protected readonly selectedIndex = computed(() =>
    this.efforts().findIndex((effort) => effort.id === this.selectedEffort()),
  );
  protected readonly effortLabel = computed(
    () => this.efforts()[this.selectedIndex()]?.label ?? '',
  );
  protected readonly triggerDescription = computed(() => {
    const mode = this.modeLabel();
    const parts = [$localize`Mode: ${mode}:mode:`];
    const resolved = this.resolvedLabel();
    if (resolved) parts.push($localize`answering in ${resolved}:mode:`);
    if (this.showEfforts()) {
      const effort = this.effortLabel();
      parts.push($localize`Reasoning effort: ${effort}:effort:`);
    }
    return parts.join('. ');
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

  /** What a mode costs per message, and what it is for; the cost comes first. */
  protected detail(mode: ChatModeOption): string {
    const cost = costOf(mode.estimatedCredits, this.locale);
    return [cost, mode.description].filter(Boolean).join(' · ');
  }

  /** How much more than Normal a mode costs; nothing at or below it. */
  protected multiplier(mode: ChatModeOption): string {
    const relative = mode.relativeCost;
    return relative && relative > 1 ? `${relative}×` : '';
  }

  /** The row's own sentence for a screen reader: the badge is decoration. */
  protected modeDescription(mode: ChatModeOption): string {
    const parts = [mode.label, this.detail(mode)].filter(Boolean);
    const relative = mode.relativeCost;
    if (relative && relative > 1) {
      parts.push($localize`${relative}:factor:× Normal`);
    }
    return parts.join('. ');
  }

  /** The models a role may run on, "Follow mode" first. */
  protected roleOptions(role: ChatRoleOption): { id: string; label: string }[] {
    const models = this.models();
    return [
      { id: FOLLOW_MODE, label: this.followModeLabel },
      ...role.models.map((id) => {
        const model = models.find((option) => option.id === id);
        return {
          id,
          label: model ? `${vendorLabelOf(model.vendor)} ${model.label}` : id,
        };
      }),
    ];
  }

  protected roleModelOf(role: ModelRole): string {
    return this.roleModels()[role] ?? FOLLOW_MODE;
  }

  protected roleValueLabel(role: ChatRoleOption): string {
    const picked = this.roleModelOf(role.id);
    if (!picked) return this.followModeLabel;
    return this.models().find((model) => model.id === picked)?.label ?? picked;
  }

  protected onVisible(visible: boolean): void {
    this.open.set(visible);
    if (!visible) {
      this.pendingMode.set(null);
      return;
    }
    this.showOptions();
  }

  protected showOptions(): void {
    this.pendingMode.set(null);
    this.expandedRole.set(null);
    this.view.set('options');
    this.focusChecked();
  }

  protected showAdvancedRoles(): void {
    this.view.set('advanced');
    this.focusChecked();
  }

  protected toggleRole(role: ModelRole): void {
    this.expandedRole.update((current) => (current === role ? null : role));
  }

  /**
   * Picks a mode, or asks first when it costs more than three times Normal
   * and the wallet covers fewer than twenty of its replies.
   */
  protected pickMode(id: ChatMode): void {
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

  protected pickEffort(id: string): void {
    if (id !== this.selectedEffort()) this.effortChange.emit(id);
  }

  protected pickRoleModel(role: ModelRole, modelId: string): void {
    if (modelId !== this.roleModelOf(role))
      this.roleModelChange.emit({ role, modelId });
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
    this.focusIn(CHECKED_OPTION_SELECTOR, OPTION_SELECTOR, 'button');
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
