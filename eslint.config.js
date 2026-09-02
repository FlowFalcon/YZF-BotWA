// @ts-check
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    // ecosystem.config.cjs is pm2 runtime config, not project TypeScript.
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'eslint.config.js', '*.cjs', 'scripts/**', '.runtime/**'],
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
    files: ['app/index.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    // Vitest spies: expect(mock.method).toHaveBeenCalledWith(...) triggers unbound-method
    // because the property access separates the mock from its object, but vitest spy assertions
    // require exactly this pattern.
    files: ['tests/**/*.test.ts'],
    rules: { '@typescript-eslint/unbound-method': 'off' },
  },
)
