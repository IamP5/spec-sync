import { ZardCommandDividerComponent } from '@/ui/components/command/command-divider.component';
import { ZardCommandInputComponent } from '@/ui/components/command/command-input.component';
import { ZardCommandListComponent } from '@/ui/components/command/command-list.component';
import { ZardCommandOptionGroupComponent } from '@/ui/components/command/command-option-group.component';
import { ZardCommandOptionComponent } from '@/ui/components/command/command-option.component';
import { ZardCommandComponent } from '@/ui/components/command/command.component';

export const ZardCommandImports = [
  ZardCommandComponent,
  ZardCommandInputComponent,
  ZardCommandListComponent,
  ZardCommandOptionComponent,
  ZardCommandOptionGroupComponent,
  ZardCommandDividerComponent,
] as const;
