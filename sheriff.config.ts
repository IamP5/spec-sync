import { config as webConfig } from '@specsync/web/sheriff.config.ts';

/**
 * Sheriff can only read its configuration from the top of the tsconfig
 * `extends` chain, which is the workspace root. The rules themselves live
 * next to the app they govern (`apps/web/sheriff.config.ts`) and are loaded
 * through the npm workspace link `@specsync/web`. Do not add rules here.
 */
export const config = webConfig;
