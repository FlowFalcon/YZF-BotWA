// @ts-check
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    // ecosystem.config.cjs is pm2 runtime config, not project TypeScript.
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'eslint.config.js', '*.cjs'],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // Entrypoint melaporkan kegagalan bootstrap sebelum logger tersedia.
    files: ['src/index.ts'],
    rules: { 'no-console': 'off' },
  },
)
