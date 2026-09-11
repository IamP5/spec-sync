import { DOCUMENT, effect, inject, Injectable } from '@angular/core';

import { EDarkModes, ZardDarkMode } from '@/ui/services';

import type { Preferences } from '../data/preferences';
import { type LocaleId, LOCALES } from '../util/locale';
import { PreferencesDetailStore } from './preferences-detail-store';

/** Applies the user's saved appearance to the design system. */
@Injectable({ providedIn: 'root' })
export class UserPreferencesCoordinator {
  private readonly store = inject(PreferencesDetailStore);
  private readonly darkMode = inject(ZardDarkMode);
  private readonly document = inject(DOCUMENT);
  readonly displayName = this.store.displayName;
  readonly showActivity = this.store.showActivity;
  readonly mode = this.store.mode;
  readonly roleModels = this.store.roleModels;
  readonly effort = this.store.effort;
  readonly hasName = this.store.hasName;
  readonly initials = this.store.initials;
  readonly theme = this.store.theme;
  readonly error = this.store.error;
  /** The language this document runs in; constant until it reloads. */
  readonly language = this.store.language;
  readonly languages = LOCALES;
  constructor() {
    effect(() => this.darkMode.toggleTheme(this.theme() as EDarkModes));
  }
  update(changes: Partial<Preferences>): void {
    this.store.update(changes);
  }
  setTheme(theme: EDarkModes): void {
    this.store.update({ theme });
  }

  /**
   * Switches the language. Translations are loaded once before bootstrap, so
   * the choice only takes effect on the next load; reloading immediately
   * keeps the user from sitting in front of a page that ignored them.
   */
  setLanguage(language: LocaleId): void {
    if (language === this.language) {
      return;
    }
    if (this.store.setLanguage(language)) {
      this.document.defaultView?.location.reload();
    }
  }
}
