import {includeIgnoreFile} from '@eslint/compat'
import {fileURLToPath} from 'node:url'
import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'
import svelte from 'eslint-plugin-svelte'
import pluginPreferLet from 'eslint-plugin-prefer-let'
import * as zxGlobals from 'zx'

/** @type {import('eslint').Linter.Config[]} */
export default [
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  includeIgnoreFile(fileURLToPath(new URL('.gitignore', import.meta.url))),
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.node,
        // https://github.com/infrakiwi/kiwi-blog/blob/main/0014-zx-scripting-in-typescript/eslint.config.mjs
        ...Object.fromEntries(Object.entries(zxGlobals).map(([key]) => [key, false])),
      },
    },
    rules: {
      'no-console':           'off',  // allow console in scripts
      'no-unused-expressions':'off',  // permit `$\`…\`` template tags
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        extraFileExtensions: ['.svelte'],
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {svelte},
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'svelte/no-immutable-reactive-statements': 'off',
      'svelte/no-reactive-reassign': 'off',
      'svelte/require-event-dispatcher-types': 'off',
    },
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,svelte}'],
    languageOptions: {globals: globals.browser},
    plugins: {'prefer-let': pluginPreferLet},
    rules: {
      'indent': ['error', 2, {SwitchCase: 1}],
      'quotes': ['error', 'single', {avoidEscape: true}],
      'semi': ['error', 'never'],
      // 'curly': ['error', 'multi', 'consistent'],
      'prefer-promise-reject-errors': ['error'],
      'require-await': ['error'],
      'array-bracket-spacing': ['error', 'never'],
      'block-spacing': ['error', 'always'],
      // 'brace-style': ['error', '1tbs', {allowSingleLine: true}], // mostly good, but I sometimes want newlines/comments above else-if statements
      'comma-dangle': ['error', 'always-multiline'],
      'comma-spacing': ['error'],
      'eol-last': ['error', 'always'],
      'func-call-spacing': ['error', 'never'],
      // 'function-call-argument-newline': ['error', 'never'],
      // 'function-paren-newline': ['error', 'never'],
      'keyword-spacing': ['error'],
      'max-depth': ['error', 4],
      'no-nested-ternary': ['error'],
      'no-tabs': ['error'],
      'no-trailing-spaces': ['error'],
      'no-whitespace-before-property': ['error'],
      '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_', varsIgnorePattern: '^_'}],
      'padded-blocks': ['error', 'never'],
      'space-before-function-paren': ['error', 'always'],
      'space-in-parens': ['error', 'never'],
      'object-curly-spacing': ['error', 'never'],
      'space-infix-ops': ['error'],
      'no-duplicate-imports': ['error'],
      'no-var': ['error'],
      'prefer-const': 'off',
      'prefer-let/prefer-let': ['error'],
      '@typescript-eslint/no-explicit-any': 'off',
      'no-case-declarations': 'off',
    },
  },
]
