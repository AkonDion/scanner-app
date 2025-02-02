/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
    },
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
        '!jest.config.js'
    ],
    setupFilesAfterEnv: ['./__tests__/setup.js'],
    testTimeout: 30000,
    extensionsToTreatAsEsm: ['.js'],
    moduleFileExtensions: ['js', 'json', 'node']
}; 