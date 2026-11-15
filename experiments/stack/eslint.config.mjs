import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(js.configs.recommended, tseslint.configs.recommendedTypeChecked, {
  files: ['src/**/*.ts'],
  languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
  rules: {
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: false }],
  },
})
