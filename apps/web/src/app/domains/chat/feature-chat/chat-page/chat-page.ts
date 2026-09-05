import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
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
  ZardMessageComponent,
  ZardMessageContentComponent,
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
import { registerChatTools } from './chat-tools';
import { ConversationDetailStore } from './conversation-detail-store';

const PROMPT_REQUIRED_MESSAGE = 'Type a message to send.';
const OFFLINE_MESSAGE =
  'The assistant is unavailable. Make sure the AI service is running.';
const FAILURE_MESSAGE = 'The assistant could not answer. Please try again.';
const MAX_PROMPT_LENGTH = 4000;

const OFFLINE_CODES: ReadonlySet<CopilotKitCoreErrorCode> = new Set([
  CopilotKitCoreErrorCode.RUNTIME_INFO_FETCH_FAILED,
  CopilotKitCoreErrorCode.AGENT_CONNECT_FAILED,
  CopilotKitCoreErrorCode.AGENT_NOT_FOUND,
]);

/**
 * Smart component of the chat feature: owns the prompt form, reads the
 * conversation from its store and forwards send/stop/reset to it. Assistant
 * turns render Markdown; tool calls render through the cards registered in
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
    ZardMessageComponent,
    ZardMessageContentComponent,
    ZardMessageGroupComponent,
    ZardSpinnerComponent,
    ZardTextareaComponent,
  ],
  viewProviders: [
    provideIcons({ lucideRotateCcw, lucideSend, lucideSparkles, lucideSquare }),
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
  protected readonly messages = this.store.messages;
  protected readonly turns = this.store.turns;
  protected readonly streaming = this.store.isStreaming;
  protected readonly empty = this.store.isEmpty;

  /** True while the run has started but no assistant text has arrived yet. */
  protected readonly awaitingReply = computed(() => {
    const last = lastOf(this.turns());
    return this.streaming() && (!last || last.role === 'user');
  });

  protected readonly error = computed(() =>
    this.store.status() === 'error' ? toErrorMessage(this.store.error()) : '',
  );

  constructor() {
    registerChatTools();

    // Keep the newest turn in view while the reply streams in.
    afterRenderEffect(() => {
      this.messages();
      const element = this.transcript()?.nativeElement;
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    });
  }

  protected textOf(turn: ChatTurn): string {
    return textOf(turn);
  }

  /** The last assistant turn re-renders on every chunk; only it needs the streaming Markdown fix-up. */
  protected isStreamingTurn(turn: ChatTurn): boolean {
    return this.streaming() && lastOf(this.turns()) === turn;
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (this.streaming()) {
      return;
    }
    submit(this.promptForm, async () => {
      const prompt = this.model().prompt.trim();
      this.model.set({ prompt: '' });
      this.promptForm.prompt().reset();
      await this.store.send(prompt);
    });
  }

  /** Enter sends, Shift+Enter inserts a line break. */
  protected onPromptKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      (event.target as HTMLElement).closest('form')?.requestSubmit();
    }
  }

  protected onStop(): void {
    this.store.stop();
  }

  protected onReset(): void {
    this.store.reset();
    this.model.set({ prompt: '' });
    this.promptForm.prompt().reset();
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
