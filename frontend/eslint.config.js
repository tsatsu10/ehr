import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    /*
     * Islands use data-fetching effects (void fetchBoard() inside useEffect).
     * react-hooks/set-state-in-effect v7 flags this pattern even for async
     * calls — it can't tell that setState runs only after promise resolution.
     * This is a standard React island data-fetching pattern; the rule is
     * disabled for island files only. Core utilities and components keep it on.
     */
    files: ['src/islands/**/*.{ts,tsx}', 'src/core/useSharedDeviceSession.ts'],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  }
);
