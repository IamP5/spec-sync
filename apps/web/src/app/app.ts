import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMoon, lucideSun } from '@ng-icons/lucide';

import { ZardButtonComponent } from '@/ui/components/button';
import { ZardSeparatorComponent } from '@/ui/components/separator';
import { EDarkModes, ZardDarkMode } from '@/ui/services';

/** Application shell: navigation, theme toggle and the routed feature. */
@Component({
  selector: 'app-root',
  imports: [NgIcon, RouterOutlet, ZardButtonComponent, ZardSeparatorComponent],
  viewProviders: [provideIcons({ lucideMoon, lucideSun })],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-h-svh' },
})
export class App {
  private readonly darkMode = inject(ZardDarkMode);

  protected readonly isDark = computed(
    () => this.darkMode.themeMode() === EDarkModes.DARK,
  );

  protected toggleTheme(): void {
    this.darkMode.toggleTheme();
  }
}
