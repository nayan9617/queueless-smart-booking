module.exports = {
    root: true,
    env: { node: true, es2020: true },
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
    ignorePatterns: ['dist/', 'uploads/', 'node_modules/', '**/*.test.ts'],
    rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': [
            'warn',
            { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
        'no-console': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/no-require-imports': 'off',
    },
};
