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
  },
  {
    /*
     * D1 i18n fence: islands migrated to t() must not regress to raw JSX
     * text. Add each island directory here as its desk-by-desk migration
     * lands (see the gap-analysis plan, D1). ignoreProps stays true —
     * className/variant/etc. would drown the signal; label-ish props are
     * covered by review + the extraction inventory, not this rule.
     */
    files: [
      'src/islands/office-notes/**/*.{ts,tsx}',
      'src/islands/proc-order/**/*.{ts,tsx}',
      'src/islands/my-profile/**/*.{ts,tsx}',
      'src/islands/rx-edit/**/*.{ts,tsx}',
      'src/islands/rx-history/**/*.{ts,tsx}',
      'src/islands/doctor-desk/**/*.{ts,tsx}',
      'src/islands/communications-hub/**/*.{ts,tsx}',
    ],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'react/jsx-no-literals': [
        'error',
        {
          noStrings: true,
          ignoreProps: true,
          allowedStrings: ['…', '—', '–', '·', '•', '×', '/', ':', '%', '(', ')', '@'],
        },
      ],
    },
  }
);
