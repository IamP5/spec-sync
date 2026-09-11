import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ZardButtonComponent } from '@/ui/components/button';

import { AuthSessionCoordinator } from '../api/authentication';

@Component({
  selector: 'app-auth-login-overview',
  imports: [ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-4 text-center" i18n-aria-label aria-label="Sign in">
      <p class="text-sm text-muted-foreground" i18n>
        Sign in to send your message and open your conversations.
      </p>
      <button
        z-button
        type="button"
        class="w-full"
        [disabled]="auth.pending()"
        (click)="auth.login()"
        i18n
      >
        Continue with Google
      </button>
      @if (auth.pending()) {
        <p role="status" class="text-sm" i18n>Checking your session…</p>
      }
      @if (auth.signInError(); as message) {
        <p role="alert" class="text-sm text-destructive">
          {{ message }}
        </p>
      }
    </section>
  `,
})
export class AuthLoginOverview {
  protected readonly auth = inject(AuthSessionCoordinator);
}
