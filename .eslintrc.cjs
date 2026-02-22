module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
    browser: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react-hooks/recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
  ],
  globals: {
    fetch: 'readonly',
    Buffer: 'readonly',
  },
  rules: {
    'no-unused-vars': 'off',
    'no-constant-condition': ['error', { checkLoops: false }],
  },
  overrides: [
    {
      files: ['api/**/*.js'],
      parserOptions: {
        sourceType: 'script',
      },
      env: {
        node: true,
        browser: false,
      },
    },
    {
      files: ['src/**/*.js', 'src/**/*.jsx'],
      env: {
        browser: true,
        node: false,
      },
    },
    {
      files: ['**/*.test.js'],
      parserOptions: {
        sourceType: 'module',
      },
      env: {
        node: true,
      },
    },
  ],
};
