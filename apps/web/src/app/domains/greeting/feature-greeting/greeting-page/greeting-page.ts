import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
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
import { lucideArrowRight, lucideCircleCheck } from '@ng-icons/lucide';

import { ZardAlertComponent } from '@/ui/components/alert';
import { ZardBadgeComponent } from '@/ui/components/badge';
import { ZardButtonComponent } from '@/ui/components/button';
import {
  ZardCardComponent,
  ZardCardContentComponent,
  ZardCardHeaderComponent,
} from '@/ui/components/card';
import { ZardInputComponent } from '@/ui/components/input';

import { GreetingDetailStore } from './greeting-detail-store';

const NAME_REQUIRED_MESSAGE = 'Enter your name to continue.';
const OFFLINE_MESSAGE =
  'The API is unavailable. Make sure the development stack is running.';
const FAILURE_MESSAGE =
  'The API could not create a greeting. Please try again.';

/**
 * Smart component of the greeting feature. Reference implementation for
 * smart components: it owns the form, reads state from its store and
 * forwards actions to it (see apps/web/docs/architecture-boundaries.md).
 */
@Component({
  selector: 'app-greeting-page',
  imports: [
    FormField,
    NgIcon,
    ZardAlertComponent,
    ZardBadgeComponent,
    ZardButtonComponent,
    ZardCardComponent,
    ZardCardContentComponent,
    ZardCardHeaderComponent,
    ZardInputComponent,
  ],
  viewProviders: [provideIcons({ lucideArrowRight, lucideCircleCheck })],
  templateUrl: './greeting-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class GreetingPage {
  private readonly store = inject(GreetingDetailStore);

  private readonly model = signal({ name: '' });

  protected readonly greetingForm = form(this.model, (path) => {
    required(path.name, { message: NAME_REQUIRED_MESSAGE });
    maxLength(path.name, 60);
    validate(path.name, ({ value }) =>
      value().trim()
        ? undefined
        : { kind: 'blank', message: NAME_REQUIRED_MESSAGE },
    );
  });

  protected readonly loading = this.store.greetingIsLoading;

  protected readonly greeting = computed(() =>
    this.store.greetingStatus() === 'resolved'
      ? this.store.greetingValue()
      : undefined,
  );

  /**
   * A request error stays visible until the user edits the name or a newer
   * error replaces it.
   */
  private readonly requestErrorVisible = linkedSignal<
    { error: unknown; name: string },
    boolean
  >({
    source: () => ({
      error: this.store.greetingError(),
      name: this.greetingForm.name().value(),
    }),
    computation: (source, previous) =>
      source.error !== undefined && source.error !== previous?.source.error,
  });

  protected readonly error = computed(() =>
    toErrorMessage(
      this.greetingForm.name(),
      this.requestErrorVisible() ? this.store.greetingError() : undefined,
    ),
  );

  protected onSubmit(event: Event): void {
    event.preventDefault();

    // `submit` marks every field as touched, then runs the action only if valid.
    submit(this.greetingForm, async () => {
      this.store.load(this.model().name.trim());
    });
  }
}

function toErrorMessage(
  nameState: { touched(): boolean; errors(): { message?: string }[] },
  requestError: unknown,
): string {
  if (nameState.touched()) {
    const [validationError] = nameState.errors();
    if (validationError) {
      return validationError.message ?? NAME_REQUIRED_MESSAGE;
    }
  }

  if (!requestError) {
    return '';
  }

  return requestError instanceof HttpErrorResponse && requestError.status === 0
    ? OFFLINE_MESSAGE
    : FAILURE_MESSAGE;
}
