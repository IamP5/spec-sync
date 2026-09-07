import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ZardDialogRef } from '@/ui/components/dialog';

import { HistorySettingsEdit } from '../../domains/chat/api/features';
import { UserPreferencesEdit } from '../../domains/user/api/features';

@Component({
  selector: 'app-settings-edit',
  imports: [UserPreferencesEdit, HistorySettingsEdit],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    '<app-user-preferences-edit (done)="close()"><app-history-settings-edit /></app-user-preferences-edit>',
})
export class SettingsEdit {
  private readonly dialog = inject(ZardDialogRef);
  protected close() {
    this.dialog.close();
  }
}
