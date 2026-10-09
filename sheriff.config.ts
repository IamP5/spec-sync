import type { SheriffConfig } from '@softarc/sheriff-core';
import { config as mobileConfig } from '@specsync/mobile/sheriff.config.ts';
import { config as webConfig } from '@specsync/web/sheriff.config.ts';

/**
 * Sheriff can only read its configuration from the top of the tsconfig
 * `extends` chain, which is the workspace root. The rules themselves live
 * next to the app they govern (`apps/web/sheriff.config.ts`,
 * `apps/mobile/sheriff.config.ts`); this file only merges them. Mobile tags
 * are prefixed with `mobile:`, so the two rule sets never match each other's
 * modules. Do not add rules here.
 */
export const config: SheriffConfig = {
  ...webConfig,
  modules: { ...webConfig.modules, ...mobileConfig.modules },
  depRules: { ...webConfig.depRules, ...mobileConfig.depRules },
};
