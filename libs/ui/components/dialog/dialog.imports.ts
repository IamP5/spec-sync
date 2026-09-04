import { OverlayModule } from '@angular/cdk/overlay';
import { PortalModule } from '@angular/cdk/portal';

import { ZardButtonComponent } from '@/ui/components/button';
import { ZardDialogComponent } from '@/ui/components/dialog/dialog.component';

export const ZardDialogImports = [ZardButtonComponent, ZardDialogComponent, OverlayModule, PortalModule] as const;
