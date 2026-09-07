import { effect, inject, Injectable, untracked } from '@angular/core';

import { EDarkModes, ZardDarkMode } from '@/ui/services';

import type { Preferences } from '../data/preferences';
import { USER_STORAGE_SCOPE } from '../util/storage-scope';
import { PreferencesDetailStore } from './preferences-detail-store';
import { UserConfigurationStore } from './user-configuration-store';

/** Coordinates saved preferences, account configuration and the active design-system theme. */
@Injectable({ providedIn: 'root' })
export class UserPreferencesCoordinator {
  private readonly store = inject(PreferencesDetailStore);
  private readonly configuration = inject(UserConfigurationStore);
  private readonly darkMode = inject(ZardDarkMode);
  readonly displayName = this.store.displayName;
  readonly showActivity = this.store.showActivity;
  readonly model = this.store.model;
  readonly effort = this.store.effort;
  readonly hasName = this.store.hasName;
  readonly initials = this.store.initials;
  readonly theme = this.darkMode.currentTheme;
  readonly error = this.configuration.error;

  constructor() {
    this.configuration.load(inject(USER_STORAGE_SCOPE)());
    this.darkMode.toggleTheme(
      this.configuration.configuration().theme as EDarkModes,
    );
    effect(() => {
      const theme = this.theme();
      untracked(() => this.configuration.update({ theme }));
    });
  }
  update(changes: Partial<Preferences>): void {
    this.store.update(changes);
  }
  setTheme(theme: EDarkModes): void {
    this.darkMode.toggleTheme(theme);
  }
}
