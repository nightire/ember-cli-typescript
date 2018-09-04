module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2017,
    sourceType: 'module',
  },
  plugins: ['ember'],
  extends: ['eslint:recommended', 'plugin:ember/recommended'],
  env: {
    browser: true,
  },
  rules: {},
  overrides: [
    {
      files: ['**/*.ts'],
      parser: 'typescript-eslint-parser',
      rules: {
        'no-undef': 'off',
        'no-unused-vars': 'off'
      }
    },

    // node files
    {
      files: [
        'ember-cli-build.js',
        'index.js',
        'testem.js',
        'blueprints/*/index.js',
        'config/**/*.js',
        'tests/dummy/config/**/*.js',
        'lib/**/*.js',
        'node-tests/**/*.js',
        'ts/**/*.{js,ts}'
      ],
      excludedFiles: ['app/**', 'addon/**', 'tests/dummy/app/**', '**/*.d.ts'],
      parserOptions: {
        sourceType: 'script',
        ecmaVersion: 2015,
      },
      env: {
        browser: false,
        node: true,
      },
      plugins: ['node'],
      rules: Object.assign({}, require('eslint-plugin-node').configs.recommended.rules, {
        'ember/avoid-leaking-state-in-ember-objects': 'off',
        'node/no-missing-require': ['error', { tryExtensions: ['.js', '.json', '.ts'] }]
      }),
    },

    {
      files: ['ts/**/*.ts'],
      excludedFiles: ['**/*.d.ts'],
      parserOptions: {
        sourceType: 'module',
      },
      rules: {
        'node/no-unsupported-features': ['error', {
          ignores: ['modules', 'asyncAwait']
        }],
      }
    },

    // test files
    {
      files: ['tests/**/*.js'],
      excludedFiles: ['tests/dummy/**/*.js'],
      env: {
        embertest: true,
      },
    },

    // node test files
    {
      files: ['node-tests/**/*.js'],
      env: {
        mocha: true,
      },
      rules: {
        'node/no-unpublished-require': 'off',
      },
    },
  ],
};
