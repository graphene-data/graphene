import globals from 'globals'

import coreLint from '../core/eslint.config.js'

export default [
  ...coreLint,
  {
    files: ['lambda/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
]
