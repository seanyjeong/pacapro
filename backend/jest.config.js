module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.test.js'],
    setupFiles: ['<rootDir>/jest.setup.js'],
    collectCoverageFrom: [
        'utils/**/*.js',
        '!utils/**/index.js',
    ],
};
