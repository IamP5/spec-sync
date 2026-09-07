import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { form, FormField, maxLength } from '@angular/forms/signals';
import { provideIcons } from '@ng-icons/core';
import { lucideMonitor, lucideMoon, lucideSun } from '@ng-icons/lucide';

import { ZardButtonComponent } from '@/ui/components/button';
import { ZardInputComponent } from '@/ui/components/input';
import { ZardSeparatorComponent } from '@/ui/components/separator';
import { ZardSwitchComponent } from '@/ui/components/switch';
import {
  ZardToggleGroupComponent,
  ZardToggleGroupItem,
} from '@/ui/components/toggle-group';
import { EDarkModes } from '@/ui/services';

import { UserPreferencesCoordinator } from '../api/preferences';
import { MAX_DISPLAY_NAME_LENGTH } from '../data/preferences';

const THEMES: ZardToggleGroupItem[] = [
  { value: EDarkModes.LIGHT, label: 'Light', icon: 'lucideSun' },
  { value: EDarkModes.DARK, label: 'Dark', icon: 'lucideMoon' },
  { value: EDarkModes.SYSTEM, label: 'System', icon: 'lucideMonitor' },
];

/**
 * Content of the settings dialog opened from the sidebar: the display name,
 * the theme and whether the transcript shows thinking and tool activity.
 * Chat may project its history action. Theme and activity apply
 * immediately; the name is saved with "Done".
 */
@Component({
  selector: 'app-user-preferences-edit',
  imports: [
    FormField,
    ZardButtonComponent,
    ZardInputComponent,
    ZardSeparatorComponent,
    ZardSwitchComponent,
    ZardToggleGroupComponent,
  ],
  viewProviders: [provideIcons({ lucideMonitor, lucideMoon, lucideSun })],
  template: `
    <form class="flex flex-col gap-6" (submit)="onSubmit($event)" novalidate>
      <div class="flex flex-col gap-2">
        <label for="display-name" class="text-sm font-medium">Your name</label>
        <input
          z-input
          id="display-name"
          type="text"
          autocomplete="name"
          placeholder="How should the assistant address you?"
          [formField]="settingsForm.displayName"
          [attr.maxlength]="maxNameLength"
          aria-describedby="display-name-help"
        />
        <p id="display-name-help" class="text-xs text-muted-foreground">
          Used to greet you in chat. Your account name comes from Google. Stored
          only in this browser.
        </p>
      </div>

      <div class="flex flex-col gap-2">
        <span id="theme-label" class="text-sm font-medium">Appearance</span>
        <z-toggle-group
          zMode="single"
          zType="outline"
          zSize="sm"
          [zItems]="themes"
          [zValue]="theme()"
          (valueChange)="onTheme($event)"
          aria-labelledby="theme-label"
        />
      </div>

      <div class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-1">
          <label for="show-activity" class="text-sm font-medium"
            >Show thinking and tool activity</label
          >
          <p class="text-xs text-muted-foreground">
            Thinking summaries and the input and output of every tool call
            appear as collapsible details in the transcript.
          </p>
        </div>
        <z-switch
          zId="show-activity"
          [zChecked]="showActivity()"
          (zCheckedChange)="onActivity($event)"
        />
      </div>

      <z-separator />

      <ng-content />

      <div class="flex justify-end">
        <button z-button type="submit" [zDisabled]="nameInvalid()">Done</button>
      </div>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class UserPreferencesEdit {
  readonly done = output<void>();
  private readonly store = inject(UserPreferencesCoordinator);

  private readonly model = signal({ displayName: this.store.displayName() });

  protected readonly settingsForm = form(this.model, (path) => {
    maxLength(path.displayName, MAX_DISPLAY_NAME_LENGTH);
  });

  protected readonly themes = THEMES;
  protected readonly maxNameLength = MAX_DISPLAY_NAME_LENGTH;
  protected readonly theme = this.store.theme;
  protected readonly showActivity = this.store.showActivity;
  protected readonly nameInvalid = computed(() =>
    this.settingsForm.displayName().invalid(),
  );

  protected onTheme(value: string | string[]): void {
    const theme = Array.isArray(value) ? value[0] : value;
    if (
      theme === EDarkModes.LIGHT ||
      theme === EDarkModes.DARK ||
      theme === EDarkModes.SYSTEM
    ) {
      this.store.setTheme(theme);
    }
  }

  protected onActivity(showActivity: boolean): void {
    this.store.update({ showActivity });
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (this.nameInvalid()) {
      return;
    }
    this.store.update({ displayName: this.model().displayName.trim() });
    this.done.emit();
  }
}
