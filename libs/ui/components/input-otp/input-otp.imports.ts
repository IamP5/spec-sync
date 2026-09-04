import { ZardInputOtpGroupComponent } from '@/ui/components/input-otp/input-otp-group.component';
import { ZardInputOtpSeparatorComponent } from '@/ui/components/input-otp/input-otp-separator.component';
import { ZardInputOtpSignalComponent } from '@/ui/components/input-otp/input-otp-signal.component';
import { ZardInputOtpSlotComponent } from '@/ui/components/input-otp/input-otp-slot.component';
import { ZardInputOtpComponent } from '@/ui/components/input-otp/input-otp.component';

export const ZardInputOtpImports = [
  ZardInputOtpComponent,
  ZardInputOtpSignalComponent,
  ZardInputOtpGroupComponent,
  ZardInputOtpSlotComponent,
  ZardInputOtpSeparatorComponent,
] as const;
