import {defineConfig} from 'oxlint'

export const sharedConfig = defineConfig({
  jsPlugins: ['eslint-plugin-prefer-let'],
  env: {
    browser: true,
  },
  rules: {
    indent: ['error', 2, {SwitchCase: 1}],
    quotes: ['error', 'single', {avoidEscape: true}],
    semi: ['error', 'never'],
    'prefer-promise-reject-errors': 'error',
    'require-await': 'error',
    'array-bracket-spacing': ['error', 'never'],
    'block-spacing': ['error', 'always'],
    'comma-dangle': ['error', 'always-multiline'],
    'comma-spacing': 'error',
    'eol-last': ['error', 'always'],
    'func-call-spacing': ['error', 'never'],
    'keyword-spacing': 'error',
    'max-depth': ['error', 4],
    'no-nested-ternary': 'error',
    'no-tabs': 'error',
    'no-trailing-spaces': 'error',
    'no-whitespace-before-property': 'error',
    'no-unassigned-vars': 'off',
    'unicorn/no-thenable': 'off',
    'unicorn/no-useless-fallback-in-spread': 'off',
    '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_', varsIgnorePattern: '^_'}],
    '@typescript-eslint/consistent-type-imports': ['error', {prefer: 'type-imports', fixStyle: 'inline-type-imports'}],
    'padded-blocks': ['error', 'never'],
    'space-before-function-paren': ['error', 'always'],
    'space-in-parens': ['error', 'never'],
    'object-curly-spacing': ['error', 'never'],
    'space-infix-ops': 'error',
    'no-duplicate-imports': 'error',
    'no-var': 'error',
    'prefer-const': 'off',
    'prefer-let/prefer-let': 'error',
    '@typescript-eslint/no-explicit-any': 'off',
    'no-case-declarations': 'off',
  },
  overrides: [
    {
      files: ['**/*.svelte'],
      env: {
        browser: true,
      },
      rules: {
        'max-depth': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
})

export default defineConfig({
  ...sharedConfig,
  ignorePatterns: [
    '**/node_modules/**',
    '**/out/**',
    '**/dist/**',
    'ui/tests/results',
    'cli/*.tgz',
    'notes.md',
    'todo.md',
    '.gitcommit',
    '*.duckdb',
    '**/.vscode/settings.json',
    'vscode/*.vsix',
    'vscode/LICENSE.md',
    'CLAUDE.md',
    '.env',
  ],
  overrides: [
    {
      files: ['scripts/**/*.js'],
      env: {
        node: true,
      },
      globals: {
        $: 'readonly',
      },
      rules: {
        'no-console': 'off',
        'no-unused-expressions': 'off',
      },
    },
    ...(sharedConfig.overrides || []),
  ],
})
