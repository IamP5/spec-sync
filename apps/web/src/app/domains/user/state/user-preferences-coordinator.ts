import { effect, inject, Injectable } from '@angular/core';

import { EDarkModes, ZardDarkMode } from '@/ui/services';

import type { Preferences } from '../data/preferences';
import { PreferencesDetailStore } from './preferences-detail-store';

/** Applies the user's saved appearance to the design system. */
@Injectable({ providedIn: 'root' })
export class UserPreferencesCoordinator {
  private readonly store = inject(PreferencesDetailStore);
  private readonly darkMode = inject(ZardDarkMode);
  readonly displayName = this.store.displayName;
  readonly showActivity = this.store.showActivity;
  readonly mode = this.store.mode;
  readonly roleModels = this.store.roleModels;
  readonly effort = this.store.effort;
  readonly hasName = this.store.hasName;
  readonly initials = this.store.initials;
  readonly theme = this.store.theme;
  readonly error = this.store.error;
  constructor() {
    effect(() => this.darkMode.toggleTheme(this.theme() as EDarkModes));
  }
  update(changes: Partial<Preferences>): void {
    this.store.update(changes);
  }
  setTheme(theme: EDarkModes): void {
    this.store.update({ theme });
  }
}
