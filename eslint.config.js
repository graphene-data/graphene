import {includeIgnoreFile} from '@eslint/compat'
import pluginJs from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import pluginPreferLet from 'eslint-plugin-prefer-let'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'
import {fileURLToPath} from 'node:url'
import tseslint from 'typescript-eslint'
import * as zxGlobals from 'zx'

/** @type {import('eslint').Linter.Config[]} */
export default [
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  includeIgnoreFile(fileURLToPath(new URL('.gitignore', import.meta.url))),
  {ignores: ['lang/parser.js']},
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
      'no-console': 'off', // allow console in scripts
      'no-unused-expressions': 'off', // permit `$\`…\`` template tags
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
      '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_', varsIgnorePattern: '^_'}],
      'svelte/no-immutable-reactive-statements': 'off',
      'svelte/no-reactive-reassign': 'off',
      'svelte/require-event-dispatcher-types': 'off',
      'svelte/no-unused-svelte-ignore': 'off', // svelte-check handles this differently
    },
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,svelte}'],
    languageOptions: {globals: globals.browser},
    plugins: {'prefer-let': pluginPreferLet, '@stylistic': stylistic},
    rules: {
      '@stylistic/indent': ['error', 2, {SwitchCase: 1}],
      '@stylistic/quotes': ['error', 'single', {avoidEscape: true}],
      '@stylistic/semi': ['error', 'never'],
      // 'curly': ['error', 'multi', 'consistent'],
      'prefer-promise-reject-errors': ['error'],
      'require-await': ['error'],
      '@stylistic/array-bracket-spacing': ['error', 'never'],
      '@stylistic/block-spacing': ['error', 'always'],
      // 'brace-style': ['error', '1tbs', {allowSingleLine: true}], // mostly good, but I sometimes want newlines/comments above else-if statements
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@stylistic/comma-spacing': ['error'],
      '@stylistic/eol-last': ['error', 'always'],
      '@stylistic/function-call-spacing': ['error', 'never'],
      // 'function-call-argument-newline': ['error', 'never'],
      // 'function-paren-newline': ['error', 'never'],
      '@stylistic/keyword-spacing': ['error'],
      'max-depth': ['error', 4],
      'no-nested-ternary': ['error'],
      'no-useless-assignment': 'off',
      '@stylistic/no-tabs': ['error'],
      '@stylistic/no-trailing-spaces': ['error'],
      '@stylistic/no-whitespace-before-property': ['error'],
      '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_', varsIgnorePattern: '^_'}],
      '@typescript-eslint/consistent-type-imports': ['error', {prefer: 'type-imports', fixStyle: 'inline-type-imports'}],
      '@stylistic/padded-blocks': ['error', 'never'],
      '@stylistic/space-before-function-paren': ['error', 'never'],
      '@stylistic/space-in-parens': ['error', 'never'],
      '@stylistic/object-curly-spacing': ['error', 'never'],
      '@stylistic/space-infix-ops': ['error'],
      'no-duplicate-imports': ['error'],
      'no-var': ['error'],
      'prefer-const': 'off',
      'prefer-let/prefer-let': ['error'],
      '@typescript-eslint/no-explicit-any': 'off',
      'no-case-declarations': 'off',
    },
  },
]
