/// <reference types="jest" />
/// <reference types="node" />
module.exports = {
  displayName: 'mobile',
  preset: 'jest-expo',
  moduleFileExtensions: ['ts', 'js', 'mjs', 'cjs', 'html', 'tsx', 'jsx'],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/arch/'],
  // The first render of a suite loads React Native, Reanimated and the design
  // system cold; on the CI runners that alone can pass jest's 5 s default.
  testTimeout: 30000,
  // jest-expo's list plus the design-system packages that ship untranspiled
  // JSX or ESM (React Native Reusables primitives, Uniwind, Lucide).
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@rn-primitives/.*|uniwind|lucide-react-native)',
  ],
  moduleNameMapper: {
    '^@mobile/(.*)$': '<rootDir>/src/$1',
    '[.]svg$': '@nx/expo/plugins/jest/svg-mock',
    '[.]css$': '<rootDir>/src/testing/style-mock.js',
  },
  transform: {
    '[.][mc]?[jt]sx?$': [
      'babel-jest',
      {
        configFile: __dirname + '/.babelrc.js',
      },
    ],
    '^.+[.](bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp|ttf|otf|m4v|mov|mp4|mpeg|mpg|webm|aac|aiff|caf|m4a|mp3|wav|html|pdf|obj)$':
      require.resolve('jest-expo/src/preset/assetFileTransformer.js'),
  },
  coverageDirectory: '../../coverage/apps/mobile',
};
