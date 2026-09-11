import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ZardDialogRef, ZardDialogService } from '@/ui/components/dialog';
import {
  ZardDropdownDirective,
  ZardDropdownMenuContentComponent,
  ZardDropdownMenuItemComponent,
  ZardDropdownMenuLabelComponent,
  ZardDropdownMenuSeparatorComponent,
} from '@/ui/components/dropdown';
import {
  ZardSidebarFooterComponent,
  ZardSidebarMenuButtonComponent,
} from '@/ui/components/sidebar';

import { AuthLogoutOverview } from '../../domains/auth/api/features';
import { SESSION } from '../../domains/auth/api/session';
import { CreditsOverview } from '../../domains/chat/api/features';
import {
  UserAppearanceOverview,
  UserLanguageOverview,
  UserProfileOverview,
} from '../../domains/user/api/features';
import type { SettingsEdit } from '../settings/settings-edit';

@Component({
  selector: 'app-account-menu-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ZardSidebarFooterComponent,
    ZardSidebarMenuButtonComponent,
    ZardDropdownDirective,
    ZardDropdownMenuContentComponent,
    ZardDropdownMenuItemComponent,
    ZardDropdownMenuLabelComponent,
    ZardDropdownMenuSeparatorComponent,
    AuthLogoutOverview,
    CreditsOverview,
    UserProfileOverview,
    UserAppearanceOverview,
    UserLanguageOverview,
  ],
  host: { class: 'contents' },
  template: ` <z-sidebar-footer
    class="mt-auto border-t border-sidebar-border p-2"
  >
    <button
      z-sidebar-menu-button
      type="button"
      zSize="lg"
      z-dropdown
      [zDropdownMenu]="menu"
      class="min-h-12"
      data-action="user-menu"
      i18n-aria-label
      aria-label="Account menu"
    >
      <app-user-profile-overview />
    </button>
    <z-dropdown-menu-content
      #menu
      zSide="top"
      zAlign="start"
      [zSideOffset]="8"
      class="flex w-64 flex-col rounded-xl"
    >
      <z-dropdown-menu-label
        ><app-user-profile-overview
      /></z-dropdown-menu-label>
      <z-dropdown-menu-separator />
      <app-credits-overview />
      <app-user-appearance-overview />
      <app-user-language-overview />
      <button
        z-dropdown-menu-item
        type="button"
        class="min-h-9 w-full rounded-md px-3"
        (click)="settings()"
        i18n
      >
        Settings
      </button>
      <z-dropdown-menu-separator />
      <app-auth-logout-overview />
    </z-dropdown-menu-content>
  </z-sidebar-footer>`,
})
export class AccountMenuOverview {
  private readonly session = inject(SESSION);
  private readonly dialog = inject(ZardDialogService);
  private readonly destroyRef = inject(DestroyRef);
  private settingsDialog?: ZardDialogRef<SettingsEdit>;
  constructor() {
    this.session.invalidated$
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.settingsDialog?.close());
    this.destroyRef.onDestroy(() => this.settingsDialog?.close());
  }
  protected async settings() {
    const scope = this.session.scope();
    if (!scope) return;
    const { SettingsEdit } = await import('../settings/settings-edit');
    if (this.destroyRef.destroyed || !this.session.isCurrent(scope)) return;
    this.settingsDialog = this.dialog.create({
      zTitle: $localize`Settings`,
      zDescription: $localize`Personalise the assistant. Preferences are stored in this browser.`,
      zContent: SettingsEdit,
      zHideFooter: true,
      zWidth: '32rem',
    });
  }
}
