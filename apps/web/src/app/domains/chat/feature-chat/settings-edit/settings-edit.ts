import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { ZardAlertDialogService } from '@/ui/components/alert-dialog';
import { ZardButtonComponent } from '@/ui/components/button';
import { ZardDialogRef } from '@/ui/components/dialog';

import { UserPreferencesEdit } from '../../../user/api/features';
import { ChatCoordinator } from '../chat-coordinator';

/** Chat owns history deletion; user owns the preferences form. */
@Component({
  selector: 'app-settings-edit',
  imports: [ZardButtonComponent, UserPreferencesEdit],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-user-preferences-edit (done)="onDone()">
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
    </app-user-preferences-edit>
  `,
})
export class SettingsEdit {
  private readonly coordinator = inject(ChatCoordinator);
  private readonly alertDialog = inject(ZardAlertDialogService);
  private readonly router = inject(Router);
  private readonly dialogRef = inject(ZardDialogRef, { optional: true });
  protected onDone(): void {
    this.dialogRef?.close();
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
}
