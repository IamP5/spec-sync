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
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideRotateCcw,
  lucideSend,
  lucideSparkles,
  lucideSquare,
} from '@ng-icons/lucide';

import { ZardAlertComponent } from '@/ui/components/alert';
import { ZardBadgeComponent } from '@/ui/components/badge';
import { ZardButtonComponent } from '@/ui/components/button';
import {
  ZardCardComponent,
  ZardCardContentComponent,
  ZardCardHeaderComponent,
} from '@/ui/components/card';
import {
  ZardMessageComponent,
  ZardMessageGroupComponent,
} from '@/ui/components/message';
import { ZardSpinnerComponent } from '@/ui/components/spinner';
import { ZardTextareaComponent } from '@/ui/components/textarea';

import { ChatRequestError } from '../../data/chat-request-error';
import { ConversationDetailStore } from './conversation-detail-store';

const PROMPT_REQUIRED_MESSAGE = 'Type a message to send.';
const OFFLINE_MESSAGE =
  'The assistant is unavailable. Make sure the AI service is running.';
const FAILURE_MESSAGE = 'The assistant could not answer. Please try again.';
const MAX_PROMPT_LENGTH = 4000;

/**
 * Smart component of the chat feature: owns the prompt form, reads the
 * conversation from its store and forwards send/stop/reset to it.
 */
@Component({
  selector: 'app-chat-page',
  imports: [
    FormField,
    NgIcon,
    ZardAlertComponent,
    ZardBadgeComponent,
    ZardButtonComponent,
    ZardCardComponent,
    ZardCardContentComponent,
    ZardCardHeaderComponent,
    ZardMessageComponent,
    ZardMessageGroupComponent,
    ZardSpinnerComponent,
    ZardTextareaComponent,
  ],
  viewProviders: [
    provideIcons({ lucideRotateCcw, lucideSend, lucideSparkles, lucideSquare }),
  ],
  templateUrl: './chat-page.html',
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

  protected readonly messages = this.store.messages;
  protected readonly streaming = this.store.isStreaming;
  protected readonly empty = this.store.isEmpty;

  protected readonly error = computed(() =>
    this.store.status() === 'error' ? toErrorMessage(this.store.error()) : '',
  );

  constructor() {
    // Keep the newest turn in view while the reply streams in.
    afterRenderEffect(() => {
      this.messages();
      const element = this.transcript()?.nativeElement;
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    });
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (this.streaming()) {
      return;
    }
    submit(this.promptForm, async () => {
      this.store.send(this.model().prompt.trim());
      this.model.set({ prompt: '' });
      this.promptForm.prompt().reset();
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

function toErrorMessage(error: unknown): string {
  return error instanceof ChatRequestError && error.status >= 502
    ? OFFLINE_MESSAGE
    : FAILURE_MESSAGE;
}
