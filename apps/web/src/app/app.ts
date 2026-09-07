import { ChangeDetectionStrategy, Component } from '@angular/core';

import { AppLayoutOverview } from './shell/app-layout/app-layout-overview';

@Component({
  selector: 'app-root',
  imports: [AppLayoutOverview],
  template: '<app-layout-overview />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
