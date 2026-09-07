import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { NgOptimizedImage, NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  disabled,
  form,
  FormField,
  maxLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { Router } from '@angular/router';
import { RenderToolCalls } from '@copilotkit/angular';
import { CopilotKitCoreErrorCode } from '@copilotkit/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowDown,
  lucideArrowUp,
  lucideBrain,
  lucideCarFront,
  lucideCheck,
  lucideCopy,
  lucideFileInput,
  lucideFileSearch,
  lucideMessageCircleQuestion,
  lucidePenLine,
  lucideRefreshCw,
  lucideSquare,
  lucideSquarePen,
} from '@ng-icons/lucide';

import { ZardAlertComponent } from '@/ui/components/alert';
import { ZardButtonComponent } from '@/ui/components/button';
import { ZardDialogRef, ZardDialogService } from '@/ui/components/dialog';
import { ZardKbdComponent } from '@/ui/components/kbd';
import {
  ZardMarkerComponent,
  ZardMarkerContentComponent,
  ZardMarkerIconComponent,
} from '@/ui/components/marker';
import {
  ZardMessageComponent,
  ZardMessageContentComponent,
  ZardMessageFooterComponent,
  ZardMessageGroupComponent,
} from '@/ui/components/message';
import { ZardSeparatorComponent } from '@/ui/components/separator';
import { ZardSidebarTriggerComponent } from '@/ui/components/sidebar';
import { ZardSkeletonComponent } from '@/ui/components/skeleton';
import { ZardSpinnerComponent } from '@/ui/components/spinner';
import { ZardTextareaComponent } from '@/ui/components/textarea';
import { ZardTooltipDirective } from '@/ui/components/tooltip';

import { AuthSessionCoordinator } from '../../../auth/api/authentication';
import { AuthLoginOverview } from '../../../auth/api/features';
import { SESSION } from '../../../auth/api/session';
import { UserPreferencesCoordinator } from '../../../user/api/preferences';
import { ChatConnectionCoordinator } from '../../api/connection';
import {
  CHAT_AGENT_ID,
  ChatAgentError,
  ChatTurn,
  textOf,
} from '../../data/chat-agent';
import {
  type ChatMode,
  effectiveEffort,
  effectiveMode,
  type ModelRole,
  modeOfRunModel,
} from '../../data/chat-model';
import { MarkdownPipe } from '../../util/markdown-pipe';
import { revealText } from '../../util/text-reveal';
import { ChatCoordinator } from '../chat-coordinator';
import { CHAT_CARD_ACTIONS } from '../tool-adapters/chat-card-actions';
import { CreditsPill } from '../ui/credits-pill';
import { RunOptionsPicker } from '../ui/run-options-picker';
import { registerChatTools } from './chat-tools';
import { ConversationDetailStore } from './conversation-detail-store';
import { ModelSearchStore } from './model-search-store';

const PROMPT_REQUIRED_MESSAGE = 'Type a message to send.';
const OFFLINE_MESSAGE =
  'The assistant is unavailable. Make sure the AI service is running.';
const FAILURE_MESSAGE = 'The assistant could not answer. Please try again.';
const MAX_PROMPT_LENGTH = 4000;
const EXHAUSTED_MESSAGE =
  'Your AI credits are used up. You can keep reading your conversations.';
const STOPPED_BY_CREDITS_PREFIX =
  'The reply was stopped because your credits ran out. ';
/** The cheapest mode; the way out of a run refused for lack of credits. */
const VELOCITY_MODE = 'velocity' as const;
const CREDITS_UNAVAILABLE_MESSAGE =
  'The credits service is unavailable. Try again in a moment.';
const COPIED_FEEDBACK_MS = 1500;
/** Distance from the end of the transcript that still counts as "at the bottom". */
const AT_BOTTOM_THRESHOLD_PX = 32;

/** Prompts offered on an empty conversation. */
const SUGGESTIONS = [
  {
    icon: 'lucidePenLine',
    label: 'Compare vehicles',
    prompt:
      'Compare Ranger Black and Limited, BR 2026, on power, torque and 360 camera.',
  },
  {
    icon: 'lucideFileSearch',
    label: 'Find related reviews',
    prompt: 'Find articles and videos reviewing the Ford Ranger ride comfort.',
  },
  {
    icon: 'lucideFileInput',
    label: 'Import specifications',
    prompt:
      'Import the official specifications of the Ford Ranger 2026 (Brazil): find the manufacturer PDF or page, show me which versions it lists, and start a reviewed import for the ones I choose.',
  },
  {
    icon: 'lucideMessageCircleQuestion',
    label: 'What can you do?',
    prompt: 'What can you help me with?',
  },
] as const;

const OFFLINE_CODES: ReadonlySet<CopilotKitCoreErrorCode> = new Set([
  CopilotKitCoreErrorCode.RUNTIME_INFO_FETCH_FAILED,
  CopilotKitCoreErrorCode.AGENT_CONNECT_FAILED,
  CopilotKitCoreErrorCode.AGENT_NOT_FOUND,
]);

/**
 * Smart component of the chat feature: owns the prompt form, reads the
 * conversation from its store and forwards send / regenerate / stop to the
 * chat coordinator, which also keeps the sidebar history in step.
 *
 * The URL decides which conversation is open: `/` is a new one, `/c/<id>`
 * a stored one (the `threadId` route parameter). The first message of a
 * new conversation moves the URL to its id.
 *
 * Assistant turns render Markdown, revealed progressively while the reply
 * streams; tool calls render through the cards registered in
 * `chat-tools.ts` (generative UI).
 *
 * The composer offers the modes, the advanced per-role model overrides and
 * the reasoning efforts the AI service reports (`ModelSearchStore`) through
 * `RunOptionsPicker`; the picks are preferences and travel with every run
 * through the coordinator.
 */
@Component({
  selector: 'app-chat-page',
  imports: [
    CdkTextareaAutosize,
    FormField,
    MarkdownPipe,
    NgIcon,
    NgTemplateOutlet,
    NgOptimizedImage,
    CreditsPill,
    RenderToolCalls,
    RunOptionsPicker,
    ZardAlertComponent,
    ZardButtonComponent,
    ZardKbdComponent,
    ZardMarkerComponent,
    ZardMarkerContentComponent,
    ZardMarkerIconComponent,
    ZardMessageComponent,
    ZardMessageContentComponent,
    ZardMessageFooterComponent,
    ZardMessageGroupComponent,
    ZardSeparatorComponent,
    ZardSidebarTriggerComponent,
    ZardSkeletonComponent,
    ZardSpinnerComponent,
    ZardTextareaComponent,
    ZardTooltipDirective,
  ],
  providers: [
    {
      provide: CHAT_CARD_ACTIONS,
      useFactory: () => {
        const page = inject(ChatPage);
        return {
          draft: (prompt: string) => page.prepareDraft(prompt),
          send: (prompt: string) => page.sendFromCard(prompt),
        };
      },
    },
  ],
  viewProviders: [
    provideIcons({
      lucideArrowDown,
      lucideArrowUp,
      lucideBrain,
      lucideCarFront,
      lucideCheck,
      lucideCopy,
      lucideFileInput,
      lucideFileSearch,
      lucideMessageCircleQuestion,
      lucidePenLine,
      lucideRefreshCw,
      lucideSquare,
      lucideSquarePen,
    }),
  ],
  templateUrl: './chat-page.html',
  styleUrl: './chat-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class ChatPage {
  private readonly store = inject(ConversationDetailStore);
  private readonly preferences = inject(UserPreferencesCoordinator);
  private readonly modelSearch = inject(ModelSearchStore);
  private readonly coordinator = inject(ChatCoordinator);
  private readonly router = inject(Router);
  private readonly transcript =
    viewChild<ElementRef<HTMLElement>>('transcript');
  private readonly floatingComposer =
    viewChild<ElementRef<HTMLElement>>('floatingComposer');
  protected readonly composerHeight = signal(180);
  private lastScrollTop = 0;
  private readonly prompt = viewChild('promptInput', {
    read: ElementRef<HTMLTextAreaElement>,
  });

  /** Route parameter of `/c/:threadId`; undefined on the root route. */
  readonly threadId = input<string>();
  private readonly session = inject(SESSION);
  private readonly auth = inject(AuthSessionCoordinator);
  private readonly connection = inject(ChatConnectionCoordinator);
  private readonly dialogs = inject(ZardDialogService);
  private loginDialog?: ZardDialogRef<AuthLoginOverview>;
  private readonly pendingPrompt = signal<string | null>(null);
  private previousUid: string | null = null;

  /** Credits are only shown once the AI service reported an actual wallet. */
  protected readonly creditsEnabled = this.coordinator.creditsEnabled;
  protected readonly creditsBalance = this.coordinator.creditsBalance;
  protected readonly creditsGranted = this.coordinator.creditsGranted;
  protected readonly creditsSpent = this.coordinator.creditsSpent;
  /** What the wallet still covers; the picker confirms an expensive switch with it. */
  protected readonly creditsAvailable = computed(() =>
    this.creditsEnabled() ? this.coordinator.creditsAvailable() : undefined,
  );
  protected readonly creditsModels = this.coordinator.creditsModels;
  protected readonly creditsRecentRuns = this.coordinator.creditsRecentRuns;
  /** No credits left: the conversation stays readable, but nothing can be sent. */
  protected readonly creditsExhausted = computed(
    () => this.creditsEnabled() && this.coordinator.creditsExhausted(),
  );
  /** The credits code of the last run failure, when it had one. */
  private readonly creditsError = computed(() =>
    this.store.status() === 'error' ? this.store.error()?.credits : undefined,
  );
  /**
   * The run was refused before the first model call. The service's own
   * sentence is shown; the browser adds only the way out.
   */
  protected readonly insufficientCredits = computed(() => {
    const error = this.creditsError();
    return error?.code === 'INSUFFICIENT_CREDITS' ? error.message : '';
  });
  /** The wallet could not be consulted, so the service refused to start a run. */
  protected readonly creditsUnavailable = computed(
    () => this.creditsError()?.code === 'CREDITS_UNAVAILABLE',
  );
  /**
   * What the exhausted banner says. The run that used the last credits ends
   * without an error, so the reason for the missing end of the reply is added
   * to the banner instead.
   */
  protected readonly exhaustedMessage = computed(() =>
    this.runEnded()
      ? `${STOPPED_BY_CREDITS_PREFIX}${EXHAUSTED_MESSAGE}`
      : EXHAUSTED_MESSAGE,
  );
  protected readonly creditsUnavailableMessage = CREDITS_UNAVAILABLE_MESSAGE;
  /**
   * Velocity is the cheapest mode, so it is the way out of a refused run.
   * Offered only while the service still has it and the user is not in it.
   */
  protected readonly canSwitchToVelocity = computed(
    () =>
      this.selectedMode() !== VELOCITY_MODE &&
      this.modes().some((mode) => mode.id === VELOCITY_MODE),
  );
  /** Sending is blocked while the wallet cannot pay for a reply. */
  protected readonly composerBlocked = computed(() => this.creditsExhausted());

  private readonly model = signal({ prompt: '' });
  private readonly animateReplies = signal(false);
  /**
   * True once a run of this conversation streamed and then ended. It tells the
   * exhausted banner whether the credits ran out during a reply the user was
   * waiting for, or were already gone when the conversation was opened. A run
   * the service refused (`INSUFFICIENT_CREDITS`) never streamed, so it does
   * not count.
   */
  private readonly runEnded = signal(false);

  protected readonly promptForm = form(this.model, (path) => {
    // No credits left: the transcript stays readable, the composer does not
    // accept anything new. Signal Forms owns the disabled state of the
    // control, so it is declared here rather than bound in the template.
    disabled(path.prompt, () => this.composerBlocked());
    required(path.prompt, { message: PROMPT_REQUIRED_MESSAGE });
    maxLength(path.prompt, MAX_PROMPT_LENGTH);
    validate(path.prompt, ({ value }) =>
      value().trim()
        ? undefined
        : { kind: 'blank', message: PROMPT_REQUIRED_MESSAGE },
    );
  });

  protected readonly agentId = CHAT_AGENT_ID;
  protected readonly suggestions = SUGGESTIONS;
  protected readonly messages = this.store.messages;
  protected readonly turns = this.store.turns;
  protected readonly streaming = this.store.isStreaming;
  protected readonly empty = this.store.isEmpty;
  /** True while a stored conversation is read back from the AI service. */
  protected readonly loadingThread = this.store.loading;
  /**
   * A stored conversation shows skeletons until its messages can be read:
   * while the session is restored, the transport prepared and the thread
   * fetched. The root route never waits; a new chat is available at once.
   */
  protected readonly loading = computed(
    () =>
      this.loadingThread() ||
      (!!this.threadId() &&
        (this.auth.pending() ||
          (this.session.authenticated() &&
            !this.connection.ready() &&
            !this.connection.error()))),
  );
  protected readonly loadingLabel = computed(() =>
    this.auth.pending() ? 'Loading your account…' : 'Loading conversation…',
  );
  protected readonly stopped = this.store.stopped;
  protected readonly title = this.store.title;
  protected readonly showActivity = this.preferences.showActivity;
  protected readonly displayName = this.preferences.displayName;
  protected readonly hasName = this.preferences.hasName;
  protected readonly copyError = signal('');
  /** Modes the service offers; the picker lists them only when there is a choice. */
  protected readonly modes = this.modelSearch.modes;
  /** Roles and models the advanced selector may override. */
  protected readonly roles = this.modelSearch.roles;
  protected readonly models = this.modelSearch.models;
  protected readonly roleModels = this.preferences.roleModels;
  /**
   * The mode auto settled on for the last run; the pill reads `Auto · Normal`.
   * Derived from the model the last run was charged at, because the catalog
   * route is shared between users and cannot carry a per-run value
   * (`modeOfRunModel`). Only meaningful while the preference is `auto`.
   */
  protected readonly resolvedMode = computed((): ChatMode | null =>
    this.selectedMode() === 'auto'
      ? modeOfRunModel(
          this.modelSearch.catalogValue(),
          this.creditsRecentRuns()[0]?.modelId,
        )
      : null,
  );
  /** The mode the next run uses: the preference if still offered, else the service default. */
  protected readonly selectedMode = computed(
    (): ChatMode =>
      effectiveMode(this.preferences.mode(), this.modelSearch.catalogValue()) ||
      this.modelSearch.defaultModeId(),
  );
  /** Reasoning efforts the service offers; the picker shows the track only when there are any. */
  protected readonly efforts = this.modelSearch.efforts;
  /** The picker shows as soon as there is anything to pick. */
  protected readonly hasRunOptions = computed(
    () => this.modes().length > 1 || this.efforts().length > 0,
  );
  /** The effort the next run uses: the preference if still offered, else the service default. */
  protected readonly selectedEffort = computed(
    () =>
      effectiveEffort(
        this.preferences.effort(),
        this.modelSearch.catalogValue(),
      ) || this.modelSearch.defaultEffortId(),
  );
  protected readonly maxPromptLength = MAX_PROMPT_LENGTH;
  protected readonly promptLength = computed(() => this.model().prompt.length);
  protected readonly promptInvalid = computed(() =>
    this.promptForm.prompt().invalid(),
  );
  protected readonly promptError = computed(() =>
    promptValidationMessage(this.model().prompt),
  );

  /** Id of the turn whose text was just copied, for the button feedback. */
  protected readonly copiedId = signal<string | null>(null);

  /** False once the user scrolled up; auto-scroll pauses and a button offers the way back. */
  protected readonly atBottom = signal(true);

  protected readonly activityStatus = computed(() => runStatus(this.turns()));

  /**
   * The generic run failure. A credits rejection has its own banner with the
   * service's wording and its own way out, so it is not repeated here.
   */
  protected readonly error = computed(() => {
    const error =
      this.store.status() === 'error' ? this.store.error() : undefined;
    return !error || error.credits ? '' : toErrorMessage(error);
  });

  /** Text of the last assistant turn, the only one that changes while it streams. */
  private readonly liveText = computed(() => {
    if (!this.animateReplies()) return '';
    const last = lastOf(this.turns());
    return last?.role === 'assistant' ? textOf(last) : '';
  });

  /** The part of `liveText` shown so far; catches up a few characters per frame. */
  private readonly revealed = revealText(this.liveText);

  constructor() {
    registerChatTools();

    this.session.changes$.pipe(takeUntilDestroyed()).subscribe(({ scope }) => {
      if (this.previousUid && scope?.uid !== this.previousUid) {
        this.clearPrompt();
        this.pendingPrompt.set(null);
        void this.router.navigateByUrl('/', { replaceUrl: true });
      }
      this.previousUid = scope?.uid ?? null;
    });
    inject(DestroyRef).onDestroy(() => this.loginDialog?.close());

    // One page and composer survive sign-in. Restore routes only when runtime is ready.
    let wasReady = false;
    effect(() => {
      const id = this.threadId();
      const ready = this.connection.ready();
      untracked(() => {
        if (ready) {
          const draft = this.model().prompt;
          this.syncWithRoute(id);
          if (!wasReady) this.model.set({ prompt: draft });
        }
        wasReady = ready;
      });
    });
    effect(() => {
      const ready = this.connection.ready();
      const pending = this.pendingPrompt();
      if (this.session.authenticated())
        untracked(() => this.loginDialog?.close());
      if (ready && pending)
        untracked(() => {
          this.pendingPrompt.set(null);
          this.clearPrompt();
          void this.send(pending);
        });
    });

    // Reserve the actual composer height as multiline input and validation resize it.
    afterRenderEffect((onCleanup) => {
      const element = this.floatingComposer()?.nativeElement;
      if (!element || typeof ResizeObserver === 'undefined') return;
      const measure = () =>
        this.composerHeight.set(
          Math.ceil(element.getBoundingClientRect().height),
        );
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      onCleanup(() => observer.disconnect());
    });

    // Tool cards, fonts and viewport changes can resize the transcript without
    // changing any of the signals used by the render effect below.
    afterRenderEffect((onCleanup) => {
      const element = this.transcript()?.nativeElement;
      if (!element || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => {
        if (untracked(this.atBottom)) this.followReply();
      });
      observer.observe(element);
      if (element.firstElementChild)
        observer.observe(element.firstElementChild);
      onCleanup(() => observer.disconnect());
    });

    // Keep the newest content in view while the reply streams in, unless the
    // user scrolled up to read something earlier.
    afterRenderEffect(() => {
      this.turns();
      this.revealed();
      this.streaming();
      this.messages();
      this.composerHeight();
      if (!this.empty() && untracked(this.atBottom)) {
        this.followReply();
      }
    });
  }

  protected activityFor(turn: ChatTurn) {
    return this.store.toolActivities().get(turn.id) ?? [];
  }

  protected textOf(turn: ChatTurn): string {
    return textOf(turn);
  }

  /** The text to render: the reveal for the last assistant turn, the full text for the rest. */
  protected visibleText(turn: ChatTurn): string {
    return this.animateReplies() && this.isLastAssistant(turn)
      ? this.revealed()
      : textOf(turn);
  }

  /** True while the turn still changes: it streams, or the reveal has not caught up. */
  protected isRevealing(turn: ChatTurn): boolean {
    return (
      this.animateReplies() &&
      this.isLastAssistant(turn) &&
      (this.streaming() || this.revealed() !== this.liveText())
    );
  }

  protected isLast(turn: ChatTurn): boolean {
    return lastOf(this.turns()) === turn;
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (
      this.streaming() ||
      this.promptInvalid() ||
      this.loading() ||
      this.composerBlocked()
    ) {
      return;
    }
    submit(this.promptForm, async () => {
      const prompt = this.model().prompt.trim();
      await this.requestSend(prompt);
    });
  }

  /** Touch keyboards keep Return for writing; desktop Enter sends. */
  protected onPromptKeydown(event: KeyboardEvent): void {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.isComposing &&
      !this.touchKeyboard()
    ) {
      event.preventDefault();
      (event.target as HTMLElement).closest('form')?.requestSubmit();
    }
  }

  prepareDraft(prompt: string): void {
    const current = this.model().prompt.trim();
    this.model.set({ prompt: current ? `${current}\n\n${prompt}` : prompt });
    this.prompt()?.nativeElement.focus();
  }

  sendFromCard(prompt: string): void {
    if (!this.streaming()) void this.requestSend(prompt);
  }

  protected onSuggestion(prompt: string): void {
    void this.requestSend(prompt);
  }

  protected async onCopy(turn: ChatTurn): Promise<void> {
    this.copyError.set('');
    try {
      await navigator.clipboard.writeText(textOf(turn));
    } catch {
      this.copyError.set(
        'Could not copy. Select the reply text and copy it manually.',
      );
      return;
    }
    this.copiedId.set(turn.id);
    setTimeout(() => {
      if (this.copiedId() === turn.id) {
        this.copiedId.set(null);
      }
    }, COPIED_FEEDBACK_MS);
  }

  protected onRegenerate(): void {
    this.animateReplies.set(true);
    this.atBottom.set(true);
    void this.coordinator.regenerate().then(() => this.markRunEnded());
  }

  protected onStop(): void {
    this.coordinator.stop();
  }

  protected onNewChat(): void {
    void this.router.navigateByUrl('/');
  }

  protected onActivityToggle(): void {
    this.preferences.update({ showActivity: !this.showActivity() });
  }

  /** Retries the refused run in Velocity, the cheapest mode the service has. */
  protected onSwitchToVelocity(): void {
    if (!this.canSwitchToVelocity()) return;
    this.onMode(VELOCITY_MODE);
    this.onRegenerate();
  }

  /** Reads the wallet again and retries, after a `CREDITS_UNAVAILABLE`. */
  protected onCreditsRetry(): void {
    this.coordinator.reloadCredits();
    this.onRegenerate();
  }

  protected onMode(mode: ChatMode): void {
    if (mode !== this.preferences.mode()) {
      this.preferences.update({ mode });
    }
  }

  /** Sets or clears one advanced override; an empty id follows the mode again. */
  protected onRoleModel(change: { role: ModelRole; modelId: string }): void {
    const roleModels = { ...this.preferences.roleModels() };
    if (change.modelId) {
      roleModels[change.role] = change.modelId;
    } else {
      delete roleModels[change.role];
    }
    this.preferences.update({ roleModels });
  }

  protected onEffort(effort: string): void {
    if (effort && effort !== this.preferences.effort()) {
      this.preferences.update({ effort });
    }
  }

  protected onDisclosureToggle(event: Event): void {
    if ((event.target as HTMLDetailsElement).open) {
      this.atBottom.set(false);
    }
  }

  protected onTranscriptFocus(event: FocusEvent): void {
    const element = this.transcript()?.nativeElement;
    const composer = this.floatingComposer()?.nativeElement;
    const target = event.target;
    if (
      !element ||
      !composer ||
      !(target instanceof HTMLElement) ||
      target === element
    )
      return;
    const overlap =
      target.getBoundingClientRect().bottom -
      (composer.getBoundingClientRect().top - 64);
    if (overlap > 0) {
      this.atBottom.set(false);
      element.scrollTop += overlap;
    }
  }

  protected onTranscriptScroll(): void {
    const element = this.transcript()?.nativeElement;
    if (element) {
      const remaining =
        element.scrollHeight - element.scrollTop - element.clientHeight;
      // Content growth and our own scroll writes must not disable following.
      if (element.scrollTop < this.lastScrollTop) {
        this.atBottom.set(false);
      } else if (remaining <= AT_BOTTOM_THRESHOLD_PX) {
        this.atBottom.set(true);
      }
      this.lastScrollTop = element.scrollTop;
    }
  }

  protected scrollToBottom(): void {
    this.atBottom.set(true);
    this.followReply();
  }

  /** Opens the thread named by the URL, or starts a new one on the root route. */
  private syncWithRoute(id: string | undefined): void {
    // The first send changes the URL to this same thread; keep its live reveal running.
    if (!id || id !== this.store.threadId()) {
      this.animateReplies.set(false);
    }
    if (id) {
      void this.coordinator.open(id).then((opened) => {
        if (!opened) void this.router.navigateByUrl('/', { replaceUrl: true });
      });
    } else if (!this.empty()) {
      this.coordinator.startNew();
    }
    this.clearPrompt();
    this.copyError.set('');
    this.atBottom.set(true);
    this.runEnded.set(false);
    this.focusForTyping();
  }

  private followReply(): void {
    const element = this.transcript()?.nativeElement;
    if (!element) return;
    // Text is already revealed per animation frame. Follow that render directly;
    // restarting a smooth-scroll animation on every token would lag behind it.
    element.scrollTop = element.scrollHeight;
    this.lastScrollTop = element.scrollTop;
  }

  private async requestSend(prompt: string): Promise<void> {
    if (!this.connection.ready()) {
      this.model.set({ prompt });
      this.pendingPrompt.set(prompt);
      if (!this.session.authenticated())
        this.loginDialog = this.dialogs.create({
          zTitle: 'Sign in to continue',
          zContent: AuthLoginOverview,
          zHideFooter: true,
          zWidth: '24rem',
          zOnCancel: () => {
            this.pendingPrompt.set(null);
          },
        });
      return;
    }
    this.clearPrompt();
    await this.send(prompt);
  }

  private async send(prompt: string): Promise<void> {
    this.animateReplies.set(true);
    this.atBottom.set(true);
    const first = this.empty();
    const sending = this.coordinator.send(prompt);
    if (first) {
      // The conversation now has an id worth bookmarking; the route effect
      // recognises it as the open one and leaves the thread alone.
      await this.router.navigate(['/c', this.store.threadId()], {
        replaceUrl: true,
      });
    }
    this.focusForTyping();
    await sending;
    this.markRunEnded();
  }

  /**
   * Records the end of a run that actually produced a reply. A run rejected
   * before the first token leaves the store in `error`; the exhausted banner
   * must not claim a reply was stopped when nothing streamed.
   */
  private markRunEnded(): void {
    this.runEnded.set(this.store.status() !== 'error');
  }

  private touchKeyboard(): boolean {
    return (
      window.matchMedia?.('(hover: none) and (pointer: coarse)').matches ??
      false
    );
  }

  private focusForTyping(): void {
    if (!this.touchKeyboard()) this.prompt()?.nativeElement.focus();
  }

  private clearPrompt(): void {
    this.model.set({ prompt: '' });
    this.promptForm.prompt().reset();
  }

  private isLastAssistant(turn: ChatTurn): boolean {
    return turn.role === 'assistant' && this.isLast(turn);
  }
}

function lastOf(turns: ChatTurn[]): ChatTurn | undefined {
  return turns[turns.length - 1];
}

function toErrorMessage(error: ChatAgentError | undefined): string {
  return error && OFFLINE_CODES.has(error.code)
    ? OFFLINE_MESSAGE
    : FAILURE_MESSAGE;
}

function runStatus(turns: ChatTurn[]): string {
  const last = lastOf(turns);
  if (last?.role === 'assistant') {
    return last.toolCalls?.length ? 'Working with tools' : 'Writing a response';
  }
  return 'Thinking';
}

function promptValidationMessage(prompt: string): string {
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return `Use ${MAX_PROMPT_LENGTH.toLocaleString('en-US')} characters or fewer.`;
  }
  return '';
}
