import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import {
  FormField,
  form,
  maxLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideCircleCheck,
  lucideMoon,
  lucideSun,
} from '@ng-icons/lucide';

import { ZardAlertComponent } from '@/ui/components/alert';
import { ZardBadgeComponent } from '@/ui/components/badge';
import { ZardButtonComponent } from '@/ui/components/button';
import { ZardCardImports } from '@/ui/components/card/card.imports';
import { ZardInputComponent } from '@/ui/components/input';
import { ZardSeparatorComponent } from '@/ui/components/separator';
import { EDarkModes, ZardDarkMode } from '@/ui/services';

interface GreetingResponse {
  message: string;
  hash: string;
}

const NAME_REQUIRED_MESSAGE = 'Enter your name to continue.';
const OFFLINE_MESSAGE =
  'The API is unavailable. Make sure the development stack is running.';
const FAILURE_MESSAGE =
  'The API could not create a greeting. Please try again.';

@Component({
  selector: 'app-root',
  imports: [
    FormField,
    NgIcon,
    ZardAlertComponent,
    ZardBadgeComponent,
    ZardButtonComponent,
    ZardCardImports,
    ZardInputComponent,
    ZardSeparatorComponent,
  ],
  viewProviders: [
    provideIcons({ lucideArrowRight, lucideCircleCheck, lucideMoon, lucideSun }),
  ],
  templateUrl: './app.html',
  host: { class: 'block min-h-svh' },
})
export class App {
  private readonly darkMode = inject(ZardDarkMode);

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

  /** The name that was actually submitted; drives the request. */
  private readonly submittedName = signal('');

  private readonly greetingResource = httpResource<GreetingResponse>(() => {
    const name = this.submittedName();
    // Returning undefined skips the request until a name has been submitted.
    return name ? { url: '/api/greeting', params: { name } } : undefined;
  });

  /**
   * A request error stays visible until the user edits the name or a newer
   * error replaces it.
   */
  private readonly requestErrorVisible = linkedSignal<
    { error: unknown; name: string },
    boolean
  >({
    source: () => ({
      error: this.greetingResource.error(),
      name: this.greetingForm.name().value(),
    }),
    computation: (source, previous) =>
      source.error !== undefined && source.error !== previous?.source.error,
  });

  protected readonly loading = this.greetingResource.isLoading;

  protected readonly greeting = computed(() =>
    this.greetingResource.hasValue() ? this.greetingResource.value() : undefined,
  );

  protected readonly error = computed(() => {
    const nameState = this.greetingForm.name();
    if (nameState.touched()) {
      const [validationError] = nameState.errors();
      if (validationError) {
        return validationError.message ?? NAME_REQUIRED_MESSAGE;
      }
    }

    const requestError = this.greetingResource.error();
    if (!requestError || !this.requestErrorVisible()) {
      return '';
    }

    return requestError instanceof HttpErrorResponse && requestError.status === 0
      ? OFFLINE_MESSAGE
      : FAILURE_MESSAGE;
  });

  protected readonly isDark = computed(
    () => this.darkMode.themeMode() === EDarkModes.DARK,
  );

  protected toggleTheme(): void {
    this.darkMode.toggleTheme();
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();

    // `submit` marks every field as touched, then runs the action only if valid.
    submit(this.greetingForm, async () => {
      const name = this.model().name.trim();

      if (this.submittedName() === name) {
        // Same params: the resource would not re-run on its own.
        this.greetingResource.reload();
      } else {
        this.submittedName.set(name);
      }
    });
  }
}
