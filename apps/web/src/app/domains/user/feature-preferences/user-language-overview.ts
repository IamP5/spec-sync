import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import {
  ZardDropdownMenuItemComponent,
  ZardDropdownMenuSubContentComponent,
  ZardDropdownMenuSubTriggerComponent,
} from '@/ui/components/dropdown';

import { UserPreferencesCoordinator } from '../api/preferences';
import type { LocaleId } from '../util/locale';

/**
 * Language submenu of the account menu, next to the appearance one. The
 * options carry their own names, so they are never translated; picking one
 * reloads SpecSync, because the translations are loaded before it starts.
 */
@Component({
  selector: 'app-user-language-overview',
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
      [zSubMenu]="language"
      i18n
    >
      Language
    </button>
    <z-dropdown-menu-sub-content
      #language
      class="flex w-56 flex-col rounded-xl p-1.5"
    >
      @for (option of preferences.languages; track option.id) {
        <button
          z-dropdown-menu-item
          type="button"
          role="menuitemradio"
          class="min-h-9 w-full rounded-md px-3"
          [attr.aria-checked]="preferences.language === option.id"
          (click)="onLanguage(option.id)"
        >
          {{ option.label }}
        </button>
      }
    </z-dropdown-menu-sub-content>
  `,
})
export class UserLanguageOverview {
  protected readonly preferences = inject(UserPreferencesCoordinator);

  protected onLanguage(language: LocaleId): void {
    this.preferences.setLanguage(language);
  }
}
