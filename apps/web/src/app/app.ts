import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';

interface GreetingResponse {
  message: string;
  hash: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly http = inject(HttpClient);

  protected readonly name = signal('');
  protected readonly greeting = signal<GreetingResponse | null>(null);
  protected readonly error = signal('');
  protected readonly loading = signal(false);

  protected updateName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
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
