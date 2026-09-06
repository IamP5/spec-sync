import { sameTag, type SheriffConfig } from '@softarc/sheriff-core';

/**
 * Sheriff enforces the domain and layer boundaries documented in
 * `apps/web/docs/architecture-boundaries.md`.
 *
 * Sheriff can only read its configuration from the workspace root (the top of
 * the tsconfig `extends` chain), so the root `sheriff.config.ts` is a stub
 * that re-exports this file. Every module path below is therefore relative to
 * the repository root, not to `apps/web`.
 *
 * Do not relax these rules to make a lint error disappear. Change them only
 * when the user explicitly asks for it (see the "Changing the Sheriff
 * Configuration" section in `apps/web/docs/architecture-boundaries.md`).
 */
export const config: SheriffConfig = {
  enableBarrelLess: true,
  modules: {
    'apps/web/src/app/domains/<domain>': {
      'feature-<name>': ['domain:<domain>', 'type:feature'],
      'ui-<name>': ['domain:<domain>', 'type:ui'],
      'data-<name>': ['domain:<domain>', 'type:data'],
      'util-<name>': ['domain:<domain>', 'type:util'],

      data: ['domain:<domain>', 'type:data'],
      ui: ['domain:<domain>', 'type:ui'],
      util: ['domain:<domain>', 'type:util'],

      // Explicit domain APIs separate model contracts from composed features.
      'api/contracts': ['domain:<domain>/api', 'type:contracts-api'],
      'api/features': ['domain:<domain>/api', 'type:features-api'],
    },

    // The design-system library (Zard/shadcn components). It is technical,
    // shared UI that every layer from `ui` upwards may use.
    'libs/ui': ['domain:shared', 'type:ui-kit'],
    'libs/ui/components/<name>': ['domain:shared', 'type:ui-kit'],
    'libs/ui/core': ['domain:shared', 'type:ui-kit'],
    'libs/ui/services': ['domain:shared', 'type:ui-kit'],
    'libs/ui/utils': ['domain:shared', 'type:ui-kit'],

    'apps/web/src/app/testing': ['testing'],
  },
  depRules: {
    // The app shell (apps/web/src/app/*.ts, routes, config) is the root module.
    root: '*',

    'domain:chat': ['domain:chat', 'domain:shared', 'domain:vehicles/api'],
    'domain:*': [sameTag, 'domain:shared'],

    'type:feature': [
      'type:feature',
      'type:features-api',
      'type:contracts-api',
      'type:ui',
      'type:ui-kit',
      'type:data',
      'type:util',
    ],
    'type:ui': ['type:ui-kit', 'type:data', 'type:util', 'type:contracts-api'],
    'type:data': ['type:util', 'type:contracts-api'],
    'type:util': [],

    // Separate contracts from component entry points; tsarch checks exports and privacy.
    'type:features-api': ['type:feature'],
    'type:contracts-api': ['type:data', 'type:util'],
    'domain:*/api': [
      ({ from, to }) => to === from.replace('/api', ''),
      'domain:shared',
    ],

    'type:ui-kit': ['type:ui-kit'],

    testing: '*',
    '*': ['testing'],
  },
};
