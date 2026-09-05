import { NgOptimizedImage, NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
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
  lucideCheck,
  lucideCopy,
  lucideFileSearch,
  lucideMessageCircleQuestion,
  lucidePenLine,
  lucideRefreshCw,
  lucideSquare,
  lucideSquarePen,
} from '@ng-icons/lucide';

import { ZardAlertComponent } from '@/ui/components/alert';
import { ZardButtonComponent } from '@/ui/components/button';
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
import { ZardSpinnerComponent } from '@/ui/components/spinner';
import { ZardTextareaComponent } from '@/ui/components/textarea';
import { ZardTooltipDirective } from '@/ui/components/tooltip';

import {
  CHAT_AGENT_ID,
  ChatAgentError,
  ChatTurn,
  textOf,
} from '../../data/chat-agent';
import { MarkdownPipe } from '../../util/markdown-pipe';
import { revealText } from '../../util/text-reveal';
import { ChatCoordinator } from '../chat-coordinator';
import { PreferencesDetailStore } from '../settings-edit/preferences-detail-store';
import { registerChatTools } from './chat-tools';
import { ConversationDetailStore } from './conversation-detail-store';

const PROMPT_REQUIRED_MESSAGE = 'Type a message to send.';
const OFFLINE_MESSAGE =
  'The assistant is unavailable. Make sure the AI service is running.';
const FAILURE_MESSAGE = 'The assistant could not answer. Please try again.';
const MAX_PROMPT_LENGTH = 4000;
const COPIED_FEEDBACK_MS = 1500;
/** Distance from the end of the transcript that still counts as "at the bottom". */
const AT_BOTTOM_THRESHOLD_PX = 32;

/** Prompts offered on an empty conversation. */
const SUGGESTIONS = [
  {
    icon: 'lucidePenLine',
    label: 'Write a requirement',
    prompt: 'Write a requirement for resetting a password by email.',
  },
  {
    icon: 'lucideFileSearch',
    label: 'Review a statement',
    prompt: 'Review: The system shall be fast and user-friendly.',
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
 */
@Component({
  selector: 'app-chat-page',
  imports: [
    FormField,
    MarkdownPipe,
    NgIcon,
    NgTemplateOutlet,
    NgOptimizedImage,
    RenderToolCalls,
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
    ZardSpinnerComponent,
    ZardTextareaComponent,
    ZardTooltipDirective,
  ],
  viewProviders: [
    provideIcons({
      lucideArrowDown,
      lucideArrowUp,
      lucideBrain,
      lucideCheck,
      lucideCopy,
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
  private readonly preferences = inject(PreferencesDetailStore);
  private readonly coordinator = inject(ChatCoordinator);
  private readonly router = inject(Router);
  private readonly transcript =
    viewChild<ElementRef<HTMLElement>>('transcript');
  private lastScrollTop = 0;
  private readonly prompt = viewChild('promptInput', {
    read: ElementRef<HTMLTextAreaElement>,
  });

  /** Route parameter of `/c/:threadId`; undefined on the root route. */
  readonly threadId = input<string>();

  private readonly model = signal({ prompt: '' });
  private readonly animateReplies = signal(false);

  protected readonly promptForm = form(this.model, (path) => {
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
  protected readonly stopped = this.store.stopped;
  protected readonly title = this.store.title;
  protected readonly showActivity = this.preferences.showActivity;
  protected readonly displayName = this.preferences.displayName;
  protected readonly hasName = this.preferences.hasName;
  protected readonly copyError = signal('');
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

  protected readonly error = computed(() =>
    this.store.status() === 'error' ? toErrorMessage(this.store.error()) : '',
  );

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

    // The URL is the source of truth for the open conversation.
    effect(() => {
      const id = this.threadId();
      untracked(() => this.syncWithRoute(id));
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
    if (this.streaming() || this.promptInvalid()) {
      return;
    }
    submit(this.promptForm, async () => {
      const prompt = this.model().prompt.trim();
      this.clearPrompt();
      await this.send(prompt);
    });
  }

  /** Enter sends, Shift+Enter inserts a line break. */
  protected onPromptKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      (event.target as HTMLElement).closest('form')?.requestSubmit();
    }
  }

  protected onSuggestion(prompt: string): void {
    void this.send(prompt);
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
    void this.coordinator.regenerate();
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

  protected onDisclosureToggle(event: Event): void {
    if ((event.target as HTMLDetailsElement).open) {
      this.atBottom.set(false);
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
      if (!this.coordinator.open(id)) {
        void this.router.navigateByUrl('/', { replaceUrl: true });
      }
    } else if (!this.empty()) {
      this.coordinator.startNew();
    }
    this.clearPrompt();
    this.copyError.set('');
    this.atBottom.set(true);
    this.prompt()?.nativeElement.focus();
  }

  private followReply(): void {
    const element = this.transcript()?.nativeElement;
    if (!element) return;
    // Text is already revealed per animation frame. Follow that render directly;
    // restarting a smooth-scroll animation on every token would lag behind it.
    element.scrollTop = element.scrollHeight;
    this.lastScrollTop = element.scrollTop;
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
    this.prompt()?.nativeElement.focus();
    await sending;
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
