import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ZardDropdownMenuItemComponent } from '@/ui/components/dropdown';

import { AuthSessionCoordinator } from '../api/authentication';

@Component({
  selector: 'app-auth-logout-overview',
  imports: [ZardDropdownMenuItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <button
      z-dropdown-menu-item
      type="button"
      class="min-h-9 w-full rounded-md px-3"
      (click)="store.logout()"
      [disabled]="store.logoutPending()"
    >
      Sign out
    </button>
    @if (store.error()) {
      <p role="alert" class="px-3 text-sm text-destructive">
        We couldn’t sign you out. Please try again.
      </p>
    }
  `,
})
export class AuthLogoutOverview {
  protected readonly store = inject(AuthSessionCoordinator);
}
