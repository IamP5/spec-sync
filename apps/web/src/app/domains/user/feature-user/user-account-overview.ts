import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronsUpDown,
  lucideMonitor,
  lucideMoon,
  lucideSettings,
  lucideSun,
} from '@ng-icons/lucide';

import { ZardAvatarComponent } from '@/ui/components/avatar';
import {
  ZardDropdownDirective,
  ZardDropdownMenuContentComponent,
  ZardDropdownMenuItemComponent,
  ZardDropdownMenuLabelComponent,
  ZardDropdownMenuSeparatorComponent,
  ZardDropdownMenuShortcutComponent,
  ZardDropdownMenuSubContentComponent,
  ZardDropdownMenuSubTriggerComponent,
} from '@/ui/components/dropdown';
import {
  ZardSidebarFooterComponent,
  ZardSidebarMenuButtonComponent,
  ZardSidebarMenuComponent,
  ZardSidebarMenuItemComponent,
} from '@/ui/components/sidebar';
import { EDarkModes } from '@/ui/services';

import { AuthLogoutOverview } from '../../auth/api/features';
import { UserPreferencesCoordinator } from '../api/preferences';
import { UserDetailStore } from './user-detail-store';

@Component({
  selector: 'app-user-account-overview',
  imports: [
    AuthLogoutOverview,
    NgIcon,
    ZardAvatarComponent,
    ZardDropdownDirective,
    ZardDropdownMenuContentComponent,
    ZardDropdownMenuItemComponent,
    ZardDropdownMenuLabelComponent,
    ZardDropdownMenuSeparatorComponent,
    ZardDropdownMenuShortcutComponent,
    ZardDropdownMenuSubContentComponent,
    ZardDropdownMenuSubTriggerComponent,
    ZardSidebarFooterComponent,
    ZardSidebarMenuButtonComponent,
    ZardSidebarMenuComponent,
    ZardSidebarMenuItemComponent,
  ],
  viewProviders: [
    provideIcons({
      lucideChevronsUpDown,
      lucideMonitor,
      lucideMoon,
      lucideSettings,
      lucideSun,
    }),
  ],
  templateUrl: './user-account-overview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class UserAccountOverview {
  readonly settings = output<void>();
  protected readonly store = inject(UserDetailStore);
  protected readonly preferences = inject(UserPreferencesCoordinator);
  protected readonly user = this.store.userValue;
  protected readonly initials = computed(() =>
    (this.user()?.displayName ?? 'User')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase(),
  );
  protected readonly theme = this.preferences.theme;
  protected readonly themes = EDarkModes;
  protected onTheme(theme: EDarkModes): void {
    this.preferences.setTheme(theme);
  }
}
