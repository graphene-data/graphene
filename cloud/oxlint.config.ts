import {defineConfig} from 'oxlint'
import {sharedConfig} from '../core/oxlint.config.ts'

export default defineConfig({
  ...sharedConfig,
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
    ...(sharedConfig.overrides || []),
  ],
})
