// ESLint handles rules that require JavaScript plugins or Svelte's template-aware parser.
// Oxlint owns core JavaScript rules, TypeScript rules, and typechecking for ordinary source files.
import {includeIgnoreFile} from '@eslint/compat'
import pluginJs from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import pluginPreferLet from 'eslint-plugin-prefer-let'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'
import {fileURLToPath} from 'node:url'
import tseslint from 'typescript-eslint'

const svelteFiles = ['**/*.svelte']

/** @type {import('eslint').Linter.Config[]} */
export default [
  {...pluginJs.configs.recommended, files: svelteFiles},
  ...tseslint.configs.recommended.map(config => ({...config, files: svelteFiles})),
  ...svelte.configs.recommended,
  includeIgnoreFile(fileURLToPath(new URL('.gitignore', import.meta.url))),
  {ignores: ['lang/parser.js']},
  {
    files: ['**/*.ts'],
    languageOptions: {parser: tseslint.parser},
  },
  {
    files: ['**/*.svelte.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: globals.browser,
    },
    rules: {
      'svelte/prefer-svelte-reactivity': 'off',
    },
  },
  {
    files: svelteFiles,
    languageOptions: {
      parserOptions: {
        extraFileExtensions: ['.svelte'],
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: globals.browser,
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
      '@stylistic/quotes': ['error', 'single', {avoidEscape: true}],
      '@stylistic/semi': ['error', 'never'],
      '@stylistic/array-bracket-spacing': ['error', 'never'],
      '@stylistic/block-spacing': ['error', 'always'],
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@stylistic/comma-spacing': ['error'],
      '@stylistic/eol-last': ['error', 'always'],
      '@stylistic/function-call-spacing': ['error', 'never'],
      '@stylistic/keyword-spacing': ['error'],
      '@stylistic/no-tabs': ['error'],
      '@stylistic/no-trailing-spaces': ['error'],
      '@stylistic/no-whitespace-before-property': ['error'],
      '@stylistic/padded-blocks': ['error', 'never'],
      '@stylistic/space-in-parens': ['error', 'never'],
      '@stylistic/object-curly-spacing': ['error', 'never'],
      '@stylistic/space-infix-ops': ['error'],
      'prefer-let/prefer-let': ['error'],
      'prefer-const': 'off',
      'no-useless-assignment': 'off',
      'no-case-declarations': 'off',
      'no-empty-pattern': ['error'], // Keep existing eslint-disable comments meaningful while Oxlint also enforces this rule.
      // Oxlint treats these legacy ESLint rules as parser checks rather than standalone rules.
      'no-dupe-args': ['error'],
      'no-octal': ['error'],
    },
  },
]
