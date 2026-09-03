import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'archive/**', 'projects/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        {
          accessibility: 'explicit',
          overrides: {
            constructors: 'explicit',
            accessors: 'explicit',
            methods: 'explicit',
            properties: 'explicit',
            parameterProperties: 'explicit',
          },
        },
      ],
      '@typescript-eslint/typedef': [
        'error',
        {
          memberVariableDeclaration: true,
          propertyDeclaration: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'preserve-caught-error': 'off',
      '@typescript-eslint/prefer-as-const': 'off',
    },
  },
);
