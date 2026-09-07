import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  contentChild,
  inject,
  TemplateRef,
} from '@angular/core';

import { AuthLoginPage } from './auth-login-page';
import { AuthSessionStore } from './auth-session-store';

/** Instantiate protected features only after the gateway verifies the session. */
@Component({
  selector: 'app-auth-session-overview',
  imports: [NgTemplateOutlet, AuthLoginPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.sessionValue()) {
      <ng-container [ngTemplateOutlet]="content() ?? null" />
    } @else {
      <app-auth-login-page />
    }
  `,
})
export class AuthSessionOverview {
  protected readonly store = inject(AuthSessionStore);
  protected readonly content = contentChild<TemplateRef<unknown>>(TemplateRef);
}
