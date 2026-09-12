import simpleImportSort from 'eslint-plugin-simple-import-sort';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    // `.mastra/**` is the generated bundle. `eval/**` is untracked decision
    // tooling (see apps/ai/eval/*/README.md): it deliberately reaches into the
    // service's modules to measure the real agent, which is not a boundary the
    // service's own code may cross, so it is linted out rather than having
    // Sheriff's encapsulation rule relaxed for everyone.
    ignores: ['.mastra/**', 'eval/**'],
  },
  {
    files: ['**/*.ts'],
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];
