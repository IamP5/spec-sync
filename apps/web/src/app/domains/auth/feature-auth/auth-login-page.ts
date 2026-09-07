import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ZardButtonComponent } from '@/ui/components/button';

import { AuthSessionStore } from './auth-session-store';

@Component({
  selector: 'app-auth-login-page',
  imports: [ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="flex h-dvh items-center justify-center bg-background p-6">
      <section
        class="w-full max-w-sm space-y-6 text-center"
        aria-labelledby="login-title"
      >
        <p class="text-sm font-semibold text-primary">Ford · SpecSync</p>
        <h1 id="login-title" class="text-2xl font-semibold tracking-tight">
          Your vehicle research workspace
        </h1>
        <p class="text-sm text-muted-foreground">
          Sign in with Google to explore vehicles and continue your
          conversations.
        </p>
        @if (!store.ready() || store.sessionIsLoading()) {
          <p role="status">Checking your session…</p>
        } @else {
          <button
            z-button
            class="w-full"
            [disabled]="store.loginIsPending()"
            (click)="store.login()"
          >
            Continue with Google
          </button>
        }
        @if (store.loginError() || store.sessionError()) {
          <p role="alert" class="text-sm text-destructive">
            We couldn’t sign you in. Please try again.
          </p>
        }
      </section>
    </main>
  `,
})
export class AuthLoginPage {
  protected readonly store = inject(AuthSessionStore);
}
