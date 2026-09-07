import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import {
  ZardAlertDialogRef,
  ZardAlertDialogService,
} from '@/ui/components/alert-dialog';
import { ZardButtonComponent } from '@/ui/components/button';

import { SESSION } from '../../../auth/api/session';
import { ChatCoordinator } from '../chat-coordinator';

/** Chat owns history deletion; user owns the preferences form. */
@Component({
  selector: 'app-history-settings-edit',
  imports: [ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
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
  `,
})
export class HistorySettingsEdit {
  private readonly coordinator = inject(ChatCoordinator);
  private readonly session = inject(SESSION);
  private confirmation?: ZardAlertDialogRef<unknown>;
  private readonly alertDialog = inject(ZardAlertDialogService);
  private readonly router = inject(Router);
  constructor() {
    this.session.invalidated$
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.confirmation?.close());
  }
  protected onClearHistory(): void {
    const scope = this.session.scope();
    if (!scope) return;
    this.confirmation = this.alertDialog.confirm({
      zTitle: 'Delete all conversations?',
      zDescription:
        'Every conversation in this browser will be removed. This cannot be undone.',
      zOkText: 'Delete all',
      zOkDestructive: true,
      zOnOk: () => {
        if (!this.session.isCurrent(scope)) return;
        void this.coordinator.clear();
        void this.router.navigateByUrl('/');
      },
    });
  }
}
