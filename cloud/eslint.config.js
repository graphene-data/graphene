import coreLint from '../core/eslint.config.js'
import globals from 'globals'

export default [
  ...coreLint,
  {
    files: ['lambda/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
]
