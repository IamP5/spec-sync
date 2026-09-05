import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
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
import { RenderToolCalls } from '@copilotkit/angular';
import { CopilotKitCoreErrorCode } from '@copilotkit/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowDown,
  lucideCheck,
  lucideCopy,
  lucideRefreshCw,
  lucideRotateCcw,
  lucideSend,
  lucideSparkles,
  lucideSquare,
} from '@ng-icons/lucide';

import { ZardAlertComponent } from '@/ui/components/alert';
import { ZardBadgeComponent } from '@/ui/components/badge';
import { ZardBubbleComponent } from '@/ui/components/bubble';
import { ZardButtonComponent } from '@/ui/components/button';
import {
  ZardCardComponent,
  ZardCardContentComponent,
  ZardCardHeaderComponent,
} from '@/ui/components/card';
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
import { ZardSpinnerComponent } from '@/ui/components/spinner';
import { ZardTextareaComponent } from '@/ui/components/textarea';

import {
  CHAT_AGENT_ID,
  ChatAgentError,
  ChatTurn,
  textOf,
} from '../../data/chat-agent';
import { MarkdownPipe } from '../../util/markdown-pipe';
import { revealText } from '../../util/text-reveal';
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
  'What can you help me with?',
  'Write a requirement for resetting a password by email.',
  'Review: The system shall be fast and user-friendly.',
] as const;

const OFFLINE_CODES: ReadonlySet<CopilotKitCoreErrorCode> = new Set([
  CopilotKitCoreErrorCode.RUNTIME_INFO_FETCH_FAILED,
  CopilotKitCoreErrorCode.AGENT_CONNECT_FAILED,
  CopilotKitCoreErrorCode.AGENT_NOT_FOUND,
]);

/**
 * Smart component of the chat feature: owns the prompt form, reads the
 * conversation from its store and forwards send / regenerate / stop / reset
 * to it. Assistant turns render Markdown, revealed progressively while the
 * reply streams; tool calls render through the cards registered in
 * `chat-tools.ts` (generative UI).
 */
@Component({
  selector: 'app-chat-page',
  imports: [
    FormField,
    MarkdownPipe,
    NgIcon,
    RenderToolCalls,
    ZardAlertComponent,
    ZardBadgeComponent,
    ZardBubbleComponent,
    ZardButtonComponent,
    ZardCardComponent,
    ZardCardContentComponent,
    ZardCardHeaderComponent,
    ZardMarkerComponent,
    ZardMarkerContentComponent,
    ZardMarkerIconComponent,
    ZardMessageComponent,
    ZardMessageContentComponent,
    ZardMessageFooterComponent,
    ZardMessageGroupComponent,
    ZardSpinnerComponent,
    ZardTextareaComponent,
  ],
  viewProviders: [
    provideIcons({
      lucideArrowDown,
      lucideCheck,
      lucideCopy,
      lucideRefreshCw,
      lucideRotateCcw,
      lucideSend,
      lucideSparkles,
      lucideSquare,
    }),
  ],
  templateUrl: './chat-page.html',
  styleUrl: './chat-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class ChatPage {
  private readonly store = inject(ConversationDetailStore);
  private readonly transcript =
    viewChild<ElementRef<HTMLElement>>('transcript');

  private readonly model = signal({ prompt: '' });

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

  /** Id of the turn whose text was just copied, for the button feedback. */
  protected readonly copiedId = signal<string | null>(null);

  /** False once the user scrolled up; auto-scroll pauses and a button offers the way back. */
  protected readonly atBottom = signal(true);

  /** True while the run has started but no assistant text has arrived yet. */
  protected readonly awaitingReply = computed(() => {
    const last = lastOf(this.turns());
    return this.streaming() && (!last || last.role === 'user');
  });

  protected readonly error = computed(() =>
    this.store.status() === 'error' ? toErrorMessage(this.store.error()) : '',
  );

  /** Text of the last assistant turn, the only one that changes while it streams. */
  private readonly liveText = computed(() => {
    const last = lastOf(this.turns());
    return last?.role === 'assistant' ? textOf(last) : '';
  });

  /** The part of `liveText` shown so far; catches up a few characters per frame. */
  private readonly revealed = revealText(this.liveText);

  constructor() {
    registerChatTools();

    // Keep the newest content in view while the reply streams in, unless the
    // user scrolled up to read something earlier.
    afterRenderEffect(() => {
      this.turns();
      this.revealed();
      this.awaitingReply();
      if (untracked(this.atBottom)) {
        this.scrollToBottom();
      }
    });
  }

  protected textOf(turn: ChatTurn): string {
    return textOf(turn);
  }

  /** The text to render: the reveal for the last assistant turn, the full text for the rest. */
  protected visibleText(turn: ChatTurn): string {
    return this.isLastAssistant(turn) ? this.revealed() : textOf(turn);
  }

  /** True while the turn still changes: it streams, or the reveal has not caught up. */
  protected isRevealing(turn: ChatTurn): boolean {
    return (
      this.isLastAssistant(turn) &&
      (this.streaming() || this.revealed() !== this.liveText())
    );
  }

  protected isLast(turn: ChatTurn): boolean {
    return lastOf(this.turns()) === turn;
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (this.streaming()) {
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
    await navigator.clipboard.writeText(textOf(turn));
    this.copiedId.set(turn.id);
    setTimeout(() => {
      if (this.copiedId() === turn.id) {
        this.copiedId.set(null);
      }
    }, COPIED_FEEDBACK_MS);
  }

  protected onRegenerate(): void {
    this.atBottom.set(true);
    void this.store.regenerate();
  }

  protected onStop(): void {
    this.store.stop();
  }

  protected onReset(): void {
    this.store.reset();
    this.clearPrompt();
    this.atBottom.set(true);
  }

  protected onTranscriptScroll(): void {
    const element = this.transcript()?.nativeElement;
    if (element) {
      const remaining =
        element.scrollHeight - element.scrollTop - element.clientHeight;
      this.atBottom.set(remaining <= AT_BOTTOM_THRESHOLD_PX);
    }
  }

  protected scrollToBottom(): void {
    this.atBottom.set(true);
    const element = this.transcript()?.nativeElement;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }

  private async send(prompt: string): Promise<void> {
    this.atBottom.set(true);
    await this.store.send(prompt);
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
