const { withNxMetro } = require('@nx/expo');
// Expo SDK 55+ ships Metro via `@expo/metro`. `getDefaultConfig` and
// `mergeConfig` must come from the Expo-provided Metro instance.
const { getDefaultConfig } = require('expo/metro-config');
const { mergeConfig } = require('@expo/metro/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const defaultConfig = getDefaultConfig(__dirname);
const { sourceExts } = defaultConfig.resolver;

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const customConfig = {
  cacheVersion: 'mobile',
  resolver: {
    sourceExts: [...sourceExts, 'cjs', 'mjs'],
  },
};

/**
 * CopilotKit pulls in `jose` for telemetry. Its default export condition
 * imports `node:` modules that Hermes cannot bundle, so resolve it to the
 * browser build (https://docs.copilotkit.ai/react-native).
 */
function withJoseBrowserBuild(config) {
  const upstream = config.resolver.resolveRequest;
  return {
    ...config,
    resolver: {
      ...config.resolver,
      resolveRequest: (context, moduleName, platform) => {
        const resolve = upstream ?? context.resolveRequest;
        if (moduleName === 'jose' || moduleName.startsWith('jose/')) {
          return resolve(
            { ...context, unstable_conditionNames: ['browser'] },
            moduleName,
            platform,
          );
        }
        return resolve(context, moduleName, platform);
      },
    },
  };
}

/**
 * Uniwind 1.12 maps every react-native-web component it knows to
 * `uniwind/components/<name>`, but ships no web build of
 * `InputAccessoryView` (react-native-web 0.21 does export one). Keep the
 * react-native-web component on web so the web bundle (`nx serve mobile`)
 * resolves.
 */
function withWebInputAccessoryView(config) {
  const upstream = config.resolver.resolveRequest;
  return {
    ...config,
    resolver: {
      ...config.resolver,
      resolveRequest: (context, moduleName, platform) => {
        const resolve = upstream ?? context.resolveRequest;
        if (
          platform === 'web' &&
          moduleName === 'uniwind/components/InputAccessoryView'
        ) {
          return resolve(
            context,
            'react-native-web/dist/exports/InputAccessoryView',
            platform,
          );
        }
        return resolve(context, moduleName, platform);
      },
    },
  };
}

module.exports = Promise.resolve(
  withNxMetro(mergeConfig(defaultConfig, customConfig), {
    // Change this to true to see debugging info.
    // Useful if you have issues resolving modules
    debug: false,
    // all the file extensions used for imports other than 'ts', 'tsx', 'js', 'jsx', 'json'
    extensions: [],
    // Specify folders to watch, in addition to Nx defaults (workspace libraries and node_modules)
    watchFolders: [],
  }),
).then((config) =>
  // Uniwind must wrap the final config (https://docs.uniwind.dev).
  withUniwindConfig(withWebInputAccessoryView(withJoseBrowserBuild(config)), {
    cssEntryFile: './src/global.css',
    dtsFile: './uniwind-types.d.ts',
  }),
);
