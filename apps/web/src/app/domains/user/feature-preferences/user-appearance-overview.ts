import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import {
  ZardDropdownMenuItemComponent,
  ZardDropdownMenuSubContentComponent,
  ZardDropdownMenuSubTriggerComponent,
} from '@/ui/components/dropdown';
import { EDarkModes } from '@/ui/services';

import { UserPreferencesCoordinator } from '../api/preferences';

@Component({
  selector: 'app-user-appearance-overview',
  imports: [
    ZardDropdownMenuItemComponent,
    ZardDropdownMenuSubContentComponent,
    ZardDropdownMenuSubTriggerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <button
      z-dropdown-menu-sub-trigger
      type="button"
      class="min-h-9 w-full rounded-md px-3"
      [zSubMenu]="appearance"
    >
      Appearance
    </button>
    <z-dropdown-menu-sub-content
      #appearance
      class="flex w-48 flex-col rounded-xl p-1.5"
    >
      @for (theme of themes; track theme.value) {
        <button
          z-dropdown-menu-item
          type="button"
          role="menuitemradio"
          class="min-h-9 w-full rounded-md px-3"
          [attr.aria-checked]="preferences.theme() === theme.value"
          (click)="preferences.setTheme(theme.value)"
        >
          {{ theme.label }}
        </button>
      }
    </z-dropdown-menu-sub-content>
    @if (preferences.error()) {
      <p role="alert" class="px-3 text-xs text-destructive">
        {{ preferences.error() }}
      </p>
    }
  `,
})
export class UserAppearanceOverview {
  protected readonly preferences = inject(UserPreferencesCoordinator);
  protected readonly themes = [
    { value: EDarkModes.LIGHT, label: 'Light' },
    { value: EDarkModes.DARK, label: 'Dark' },
    { value: EDarkModes.SYSTEM, label: 'System' },
  ];
}
