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
      state: ['domain:<domain>', 'type:state'],
      session: ['domain:<domain>', 'type:session-runtime'],
      transport: ['domain:<domain>', 'type:transport'],

      // Technical entry names are architectural roles. All other entry names
      // describe capabilities and follow the same public coordinator rules.
      'api/contracts': ['domain:<domain>/api', 'type:contracts-api'],
      'api/features': ['domain:<domain>/api', 'type:features-api'],
      'api/events': ['domain:<domain>/api', 'type:events-api'],
      'api/session': ['domain:<domain>/api', 'type:session-api'],
      'api/bootstrap': ['domain:<domain>/api', 'type:bootstrap-api'],
      'api/<capability>': ['domain:<domain>/api', 'type:capability-api'],
      '<layer>': ['domain:<domain>', 'type:unclassified'],
    },

    // The design-system library (Zard/shadcn components). It is technical,
    // shared UI that every layer from `ui` upwards may use.
    'libs/ui': ['domain:shared', 'type:ui-kit'],
    'libs/ui/components/<name>': ['domain:shared', 'type:ui-kit'],
    'libs/ui/core': ['domain:shared', 'type:ui-kit'],
    'libs/ui/services': ['domain:shared', 'type:ui-kit'],
    'libs/ui/utils': ['domain:shared', 'type:ui-kit'],

    'apps/web/src/app/testing': ['testing'],
    'apps/web/src/app/shell': ['shell', 'type:shell'],
  },
  depRules: {
    // The app shell (apps/web/src/app/*.ts, routes, config) is the root module.
    root: '*',

    // All matching Sheriff rules are additive. Keep ownership and API access
    // together so a wildcard cannot override the shared/API restrictions.
    'domain:*': [
      sameTag,
      'domain:shared',
      ({ from, to }) =>
        from.endsWith('/api')
          ? to === from.slice(0, -4)
          : to === `${from}/api` ||
            (from !== 'domain:shared' && /^domain:.+\/api$/.test(to)),
    ],
    shell: ['shell', 'domain:shared', 'domain:*/api'],
    'type:shell': [
      'type:shell',
      'type:ui-kit',
      'type:features-api',
      'type:session-api',
      'type:capability-api',
    ],

    'type:state': [
      'type:state',
      'type:data',
      'type:util',
      'type:ui-kit',
      'type:events-api',
      'type:session-api',
      'type:session-runtime',
    ],
    'type:events-api': [],
    'type:session-api': ['type:session-runtime'],
    'type:capability-api': ['type:state'],
    'type:bootstrap-api': ['type:data', 'type:transport', 'type:util'],
    'type:session-runtime': ['type:events-api', 'type:util'],
    'type:transport': ['type:data', 'type:session-runtime', 'type:util'],
    'type:feature': [
      'type:state',
      'type:events-api',
      'type:session-api',
      'type:capability-api',
      'type:feature',
      'type:features-api',
      'type:contracts-api',
      'type:ui',
      'type:ui-kit',
      'type:data',
      'type:util',
    ],
    'type:ui': ['type:ui-kit', 'type:data', 'type:util', 'type:contracts-api'],
    'type:data': [
      'type:util',
      'type:contracts-api',
      'type:events-api',
      'type:session-api',
      'type:session-runtime',
    ],
    'type:util': [],
    'type:unclassified': [],

    // API entry checks, private state, UI purity and cycles live in arch/.
    'type:features-api': ['type:feature'],
    'type:contracts-api': ['type:data', 'type:util'],

    'type:ui-kit': ['type:ui-kit'],

    testing: '*',
    '*': ['testing'],
  },
};
