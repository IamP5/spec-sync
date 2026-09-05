import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { form, FormField, maxLength } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideMonitor, lucideMoon, lucideSun } from '@ng-icons/lucide';

import { ZardAlertDialogService } from '@/ui/components/alert-dialog';
import { ZardButtonComponent } from '@/ui/components/button';
import { ZardDialogRef } from '@/ui/components/dialog';
import { ZardInputComponent } from '@/ui/components/input';
import { ZardSeparatorComponent } from '@/ui/components/separator';
import { ZardSwitchComponent } from '@/ui/components/switch';
import {
  ZardToggleGroupComponent,
  ZardToggleGroupItem,
} from '@/ui/components/toggle-group';
import { EDarkModes, ZardDarkMode } from '@/ui/services';

import { MAX_DISPLAY_NAME_LENGTH } from '../../data/preferences';
import { ChatCoordinator } from '../chat-coordinator';
import { PreferencesDetailStore } from './preferences-detail-store';

const THEMES: ZardToggleGroupItem[] = [
  { value: EDarkModes.LIGHT, label: 'Light', icon: 'lucideSun' },
  { value: EDarkModes.DARK, label: 'Dark', icon: 'lucideMoon' },
  { value: EDarkModes.SYSTEM, label: 'System', icon: 'lucideMonitor' },
];

/**
 * Content of the settings dialog opened from the sidebar: the display name,
 * the theme, whether the transcript shows thinking and tool activity, and
 * the option to delete the conversation history. Theme and activity apply
 * immediately; the name is saved with "Done".
 */
@Component({
  selector: 'app-settings-edit',
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
          Shown in the sidebar and used to greet you. Stored only in this
          browser.
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

      <div class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-1">
          <span class="text-sm font-medium">Conversation history</span>
          <p class="text-xs text-muted-foreground">
            Removes every conversation from this browser.
          </p>
        </div>
        <button
          z-button
          zType="outline"
          zSize="sm"
          type="button"
          class="shrink-0 text-destructive hover:text-destructive"
          data-action="clear-history"
          (click)="onClearHistory()"
        >
          Delete all
        </button>
      </div>

      <div class="flex justify-end">
        <button z-button type="submit" [zDisabled]="nameInvalid()">Done</button>
      </div>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class SettingsEdit {
  private readonly store = inject(PreferencesDetailStore);
  private readonly coordinator = inject(ChatCoordinator);
  private readonly darkMode = inject(ZardDarkMode);
  private readonly alertDialog = inject(ZardAlertDialogService);
  private readonly router = inject(Router);
  private readonly dialogRef = inject(ZardDialogRef, { optional: true });

  private readonly model = signal({ displayName: this.store.displayName() });

  protected readonly settingsForm = form(this.model, (path) => {
    maxLength(path.displayName, MAX_DISPLAY_NAME_LENGTH);
  });

  protected readonly themes = THEMES;
  protected readonly maxNameLength = MAX_DISPLAY_NAME_LENGTH;
  protected readonly theme = this.darkMode.currentTheme;
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
      this.darkMode.toggleTheme(theme);
    }
  }

  protected onActivity(showActivity: boolean): void {
    this.store.update({ showActivity });
  }

  protected onClearHistory(): void {
    this.alertDialog.confirm({
      zTitle: 'Delete all conversations?',
      zDescription:
        'Every conversation in this browser will be removed. This cannot be undone.',
      zOkText: 'Delete all',
      zOkDestructive: true,
      zOnOk: () => {
        this.coordinator.clear();
        this.dialogRef?.close();
        void this.router.navigateByUrl('/');
      },
    });
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (this.nameInvalid()) {
      return;
    }
    this.store.update({ displayName: this.model().displayName.trim() });
    this.dialogRef?.close();
  }
}
