import nx from '@nx/eslint-plugin';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

import baseConfig from '../../eslint.config.mjs';

/**
 * Lint rules for the Expo app. Each restriction below encodes a rule of the
 * installed Expo and Vercel React Native skills or of
 * apps/mobile/docs/architecture-boundaries.md. Fix the code; do not relax a
 * rule to make a check pass.
 */
const restrictedImports = {
  paths: [
    {
      name: 'react-native',
      importNames: [
        'Image',
        'TouchableOpacity',
        'TouchableHighlight',
        'TouchableWithoutFeedback',
        'SafeAreaView',
        'Animated',
        'PanResponder',
        'AsyncStorage',
      ],
      message:
        'Use expo-image, Pressable, contentInsetAdjustmentBehavior or react-native-safe-area-context, and Reanimated instead (vercel-react-native-skills).',
    },
    {
      name: '@react-native-async-storage/async-storage',
      message:
        'Use expo-secure-store for secrets and expo-sqlite/localStorage for preferences (expo-native-ui storage).',
    },
    { name: 'expo-av', message: 'Use expo-audio or expo-video.' },
    {
      name: 'expo-linear-gradient',
      message: 'Use experimental_backgroundImage gradients.',
    },
    { name: 'axios', message: 'Use expo/fetch (expo-data-fetching).' },
  ],
  patterns: [
    {
      group: ['@react-navigation/*'],
      message:
        'SDK 56: import navigation from expo-router or expo-router/react-navigation.',
    },
  ],
};

export default [
  ...nx.configs['flat/react'],
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // `{count && <X />}` renders a bare 0 or '' and crashes React Native.
      'react/jsx-no-leaked-render': [
        'error',
        { validStrategies: ['ternary', 'coerce'] },
      ],
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    rules: {
      'no-restricted-imports': ['error', restrictedImports],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='useContext']",
          message: 'React 19: read a context with use(Context).',
        },
        {
          selector: "MemberExpression[property.name='useContext']",
          message: 'React 19: read a context with use(Context).',
        },
        {
          selector: "CallExpression[callee.name='forwardRef']",
          message: 'React 19: pass ref as a prop instead of forwardRef.',
        },
      ],
    },
  },
  {
    // Screens and components render text and inputs through the design
    // system (React Native Reusables), which carries the Ford tokens.
    files: ['src/**/*.tsx'],
    ignores: ['src/design-system/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          ...restrictedImports,
          paths: [
            ...restrictedImports.paths,
            {
              name: 'react-native',
              importNames: ['Text', 'TextInput', 'Button', 'Switch'],
              message:
                'Use the design-system components from @mobile/design-system/components/ui.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
  {
    // Generated React Native Reusables components keep the registry's code
    // style so `add --overwrite` stays a clean update. The CLI writes imports
    // through the `@mobile/*` alias (components.json); app code imports
    // relatively, like apps/web (libs/ui has the same exemption for Zard).
    files: ['src/design-system/components/ui/**'],
    rules: {
      '@nx/enforce-module-boundaries': 'off',
      'simple-import-sort/imports': 'off',
      'simple-import-sort/exports': 'off',
      'no-restricted-syntax': 'off',
    },
  },
  {
    ignores: [
      '.expo',
      '.agents',
      '.claude',
      'web-build',
      'cache',
      'dist',
      'expo-env.d.ts',
    ],
  },
];
