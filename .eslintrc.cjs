module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended'
  ],
  env: {
    node: true,
    es6: true
  },
  globals: {
    NodeJS: 'readonly'
  },
  rules: {
    // TypeScript rules
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-unused-vars': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',

    // General rules
    'no-var': 'error',
    'prefer-const': 'error',
    'no-console': 'off',
    'eqeqeq': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error'
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.spec.ts'],
      rules: {
        'no-console': 'off'
      }
    }
  ]
};