import { ZardDropdownMenuItemComponent } from '@/ui/components/dropdown/dropdown-item.component';
import { ZardDropdownMenuContentComponent } from '@/ui/components/dropdown/dropdown-menu-content.component';
import {
  ZardDropdownMenuCheckboxItemComponent,
  ZardDropdownMenuGroupComponent,
  ZardDropdownMenuLabelComponent,
  ZardDropdownMenuRadioGroupComponent,
  ZardDropdownMenuRadioItemComponent,
  ZardDropdownMenuSeparatorComponent,
  ZardDropdownMenuShortcutComponent,
} from '@/ui/components/dropdown/dropdown-primitives.component';
import {
  ZardDropdownMenuSubContentComponent,
  ZardDropdownMenuSubTriggerComponent,
} from '@/ui/components/dropdown/dropdown-submenu.component';
import { ZardDropdownDirective } from '@/ui/components/dropdown/dropdown-trigger.directive';
import { ZardDropdownMenuComponent } from '@/ui/components/dropdown/dropdown.component';

export const ZardDropdownImports = [
  ZardDropdownMenuComponent,
  ZardDropdownMenuItemComponent,
  ZardDropdownMenuContentComponent,
  ZardDropdownMenuGroupComponent,
  ZardDropdownMenuSeparatorComponent,
  ZardDropdownMenuShortcutComponent,
  ZardDropdownMenuCheckboxItemComponent,
  ZardDropdownMenuRadioGroupComponent,
  ZardDropdownMenuRadioItemComponent,
  ZardDropdownMenuLabelComponent,
  ZardDropdownMenuSubTriggerComponent,
  ZardDropdownMenuSubContentComponent,
  ZardDropdownDirective,
] as const;
