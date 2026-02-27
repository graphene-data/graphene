import {defineConfig} from 'oxlint'
import {sharedConfig} from '../core/oxlint.config.ts'

let base = sharedConfig as any

export default defineConfig({
  ...base,
  ignorePatterns: [
    'node_modules',
    'tests/results',
    'dist',
    '.pglite',
    '.env',
    '*.zip',
  ],
  overrides: [
    {
      files: ['lambda/**/*.js'],
      env: {
        node: true,
      },
    },
    ...(base.overrides || []),
  ],
})
