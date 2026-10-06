// @ts-check
import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'

// Clean-code size and complexity limits for production code. Tests and e2e specs are exempt: a
// test reads best as one straight story, even when that story is long.
const CODE_METRICS = {
  complexity: ['error', 8],
  'max-depth': ['error', 3],
  'max-params': ['error', 4],
  'max-nested-callbacks': ['error', 3],
  'max-statements': ['error', 15],
  'max-lines-per-function': ['error', { max: 40, skipBlankLines: true, skipComments: true }],
  'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
}

export default defineConfig([
  globalIgnores(['**/dist/**', '**/build/**', '**/node_modules/**', '**/test-results/**']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['packages/app/**/*.ts', 'packages/data-pipeline/**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    extends: [tseslint.configs.recommendedTypeCheckedOnly],
  },
  {
    // e2e init scripts wrap browser prototype methods and call the originals with .apply.
    files: ['packages/app/e2e/**/*.ts'],
    rules: { '@typescript-eslint/unbound-method': 'off' },
  },
  {
    files: ['packages/*/src/**/*.ts', 'packages/engine/assembly/**/*.ts'],
    ignores: ['packages/engine/assembly/data/**'],
    rules: CODE_METRICS,
  },
])
