import { ZardContextMenuDirective } from '@/ui/components/navigation-menu/context-menu.directive';
import { ZardNavigationMenuContentDirective } from '@/ui/components/navigation-menu/navigation-menu-content.directive';
import { ZardNavigationMenuIndicatorComponent } from '@/ui/components/navigation-menu/navigation-menu-indicator.component';
import { ZardNavigationMenuItemDirective } from '@/ui/components/navigation-menu/navigation-menu-item.directive';
import { ZardNavigationMenuLabelComponent } from '@/ui/components/navigation-menu/navigation-menu-label.component';
import { ZardNavigationMenuLinkDirective } from '@/ui/components/navigation-menu/navigation-menu-link.directive';
import { ZardNavigationMenuListDirective } from '@/ui/components/navigation-menu/navigation-menu-list.directive';
import { ZardNavigationMenuShortcutComponent } from '@/ui/components/navigation-menu/navigation-menu-shortcut.component';
import { ZardNavigationMenuTriggerDirective } from '@/ui/components/navigation-menu/navigation-menu-trigger.directive';
import { ZardNavigationMenuViewportComponent } from '@/ui/components/navigation-menu/navigation-menu-viewport.component';
import { ZardNavigationMenuComponent } from '@/ui/components/navigation-menu/navigation-menu.component';

export const ZardNavigationMenuImports = [
  ZardNavigationMenuComponent,
  ZardNavigationMenuListDirective,
  ZardNavigationMenuItemDirective,
  ZardNavigationMenuTriggerDirective,
  ZardNavigationMenuContentDirective,
  ZardNavigationMenuLinkDirective,
  ZardNavigationMenuIndicatorComponent,
  ZardNavigationMenuViewportComponent,
  ZardNavigationMenuLabelComponent,
  ZardNavigationMenuShortcutComponent,
  ZardContextMenuDirective,
] as const;
