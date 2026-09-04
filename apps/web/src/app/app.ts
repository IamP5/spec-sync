import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
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

@Component({
  selector: 'app-root',
  imports: [
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
  private readonly http = inject(HttpClient);
  private readonly darkMode = inject(ZardDarkMode);

  protected readonly name = signal('');
  protected readonly greeting = signal<GreetingResponse | null>(null);
  protected readonly error = signal('');
  protected readonly loading = signal(false);

  protected readonly isDark = () =>
    this.darkMode.themeMode() === EDarkModes.DARK;

  protected toggleTheme(): void {
    this.darkMode.toggleTheme();
  }

  protected updateName(value: string | number | null | undefined): void {
    this.name.set(String(value ?? ''));
    this.error.set('');
  }

  protected submit(event: Event): void {
    event.preventDefault();

    const name = this.name().trim();
    if (!name) {
      this.greeting.set(null);
      this.error.set('Enter your name to continue.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.http
      .get<GreetingResponse>('/api/greeting', { params: { name } })
      .subscribe({
        next: (greeting) => {
          this.greeting.set(greeting);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.greeting.set(null);
          this.loading.set(false);
          this.error.set(
            error.status === 0
              ? 'The API is unavailable. Make sure the development stack is running.'
              : 'The API could not create a greeting. Please try again.',
          );
        },
      });
  }
}
