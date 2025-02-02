/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    transform: {
        '^.+\\.js$': ['babel-jest', { configFile: './.babelrc' }]
    },
    transformIgnorePatterns: [
        'node_modules/(?!(node-fetch|data-uri-to-buffer|fetch-blob|formdata-polyfill)/)'
    ],
    testMatch: ['**/__tests__/**/*.test.js'],
    coverageDirectory: './coverage',
    collectCoverageFrom: [
        '*.js',
        '!jest.config.cjs'
    ],
    testTimeout: 30000,
    moduleFileExtensions: ['js', 'json', 'node'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
    }
}; 