import { sameTag, type SheriffConfig } from '@softarc/sheriff-core';

/**
 * Sheriff enforces the domain and layer boundaries documented in
 * `apps/mobile/docs/architecture-boundaries.md`. They mirror the web app's
 * rules (`apps/web/sheriff.config.ts`) one for one.
 *
 * Every tag carries the `mobile:` prefix so a mobile domain can never satisfy
 * a web rule (both apps have a `chat` domain). Sheriff reads one config from
 * the workspace root, so the root `sheriff.config.ts` merges this file with
 * the web config; module paths are relative to the repository root.
 *
 * Do not relax these rules to make a lint error disappear. Change them only
 * when the user explicitly asks for it.
 */
export const config: Pick<SheriffConfig, 'modules' | 'depRules'> = {
  modules: {
    'apps/mobile/src/domains/<domain>': {
      'feature-<name>': ['mobile:domain:<domain>', 'mobile:type:feature'],
      'ui-<name>': ['mobile:domain:<domain>', 'mobile:type:ui'],
      'data-<name>': ['mobile:domain:<domain>', 'mobile:type:data'],
      'util-<name>': ['mobile:domain:<domain>', 'mobile:type:util'],

      data: ['mobile:domain:<domain>', 'mobile:type:data'],
      ui: ['mobile:domain:<domain>', 'mobile:type:ui'],
      util: ['mobile:domain:<domain>', 'mobile:type:util'],
      state: ['mobile:domain:<domain>', 'mobile:type:state'],
      session: ['mobile:domain:<domain>', 'mobile:type:session-runtime'],
      transport: ['mobile:domain:<domain>', 'mobile:type:transport'],

      // Technical entry names are architectural roles. All other entry names
      // describe capabilities and follow the same public coordinator rules.
      'api/contracts': [
        'mobile:domain:<domain>/api',
        'mobile:type:contracts-api',
      ],
      'api/features': [
        'mobile:domain:<domain>/api',
        'mobile:type:features-api',
      ],
      'api/events': ['mobile:domain:<domain>/api', 'mobile:type:events-api'],
      'api/session': ['mobile:domain:<domain>/api', 'mobile:type:session-api'],
      'api/bootstrap': [
        'mobile:domain:<domain>/api',
        'mobile:type:bootstrap-api',
      ],
      'api/<capability>': [
        'mobile:domain:<domain>/api',
        'mobile:type:capability-api',
      ],
      '<layer>': ['mobile:domain:<domain>', 'mobile:type:unclassified'],
    },

    // Expo Router routes: the composition root (web: app.routes.ts and
    // app.providers.ts). Routes stay thin and use public entries only.
    'apps/mobile/src/app': ['mobile:route'],

    // React Native Reusables components with the Ford tokens (web: libs/ui).
    'apps/mobile/src/design-system': [
      'mobile:domain:shared',
      'mobile:type:ui-kit',
    ],

    'apps/mobile/src/shell': ['mobile:shell', 'mobile:type:shell'],
    'apps/mobile/src/testing': ['testing'],
  },
  depRules: {
    // All matching Sheriff rules are additive. Keep ownership and API access
    // together so a wildcard cannot override the shared/API restrictions.
    'mobile:domain:*': [
      sameTag,
      'mobile:domain:shared',
      ({ from, to }) =>
        from.endsWith('/api')
          ? to === from.slice(0, -4)
          : to === `${from}/api` ||
            (from !== 'mobile:domain:shared' &&
              /^mobile:domain:.+\/api$/.test(to)),
    ],
    'mobile:route': [
      'mobile:type:features-api',
      'mobile:type:bootstrap-api',
      'mobile:type:ui-kit',
      'mobile:type:shell',
      'mobile:domain:shared',
    ],
    'mobile:shell': [
      'mobile:shell',
      'mobile:domain:shared',
      'mobile:domain:*/api',
    ],
    'mobile:type:shell': [
      'mobile:type:shell',
      'mobile:type:ui-kit',
      'mobile:type:features-api',
      'mobile:type:session-api',
      'mobile:type:capability-api',
    ],

    'mobile:type:state': [
      'mobile:type:state',
      'mobile:type:data',
      'mobile:type:util',
      'mobile:type:events-api',
      'mobile:type:session-api',
      'mobile:type:session-runtime',
    ],
    'mobile:type:events-api': [],
    'mobile:type:session-api': ['mobile:type:session-runtime'],
    'mobile:type:capability-api': ['mobile:type:state'],
    'mobile:type:bootstrap-api': [
      'mobile:type:data',
      'mobile:type:transport',
      'mobile:type:util',
    ],
    'mobile:type:session-runtime': [
      'mobile:type:events-api',
      'mobile:type:util',
    ],
    'mobile:type:transport': [
      'mobile:type:data',
      'mobile:type:session-runtime',
      'mobile:type:util',
    ],
    'mobile:type:feature': [
      'mobile:type:state',
      'mobile:type:events-api',
      'mobile:type:session-api',
      'mobile:type:capability-api',
      'mobile:type:feature',
      'mobile:type:features-api',
      'mobile:type:contracts-api',
      'mobile:type:ui',
      'mobile:type:ui-kit',
      'mobile:type:data',
      'mobile:type:util',
    ],
    'mobile:type:ui': [
      'mobile:type:ui-kit',
      'mobile:type:data',
      'mobile:type:util',
      'mobile:type:contracts-api',
    ],
    'mobile:type:data': [
      'mobile:type:util',
      'mobile:type:contracts-api',
      'mobile:type:events-api',
      'mobile:type:session-api',
      'mobile:type:session-runtime',
    ],
    'mobile:type:util': [],
    'mobile:type:unclassified': [],

    // API entry checks, private state, UI purity and cycles live in arch/.
    'mobile:type:features-api': ['mobile:type:feature'],
    'mobile:type:contracts-api': ['mobile:type:data', 'mobile:type:util'],

    'mobile:type:ui-kit': ['mobile:type:ui-kit'],
  },
};
