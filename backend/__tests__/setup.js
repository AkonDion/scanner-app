const { jest } = require('@jest/globals');

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3002';

// Mock node-fetch
global.fetch = jest.fn();

// Basic test to ensure setup is working
describe('Test Environment Setup', () => {
    test('environment variables are set correctly', () => {
        expect(process.env.NODE_ENV).toBe('test');
        expect(process.env.PORT).toBe('3002');
    });

    test('fetch is mocked', () => {
        expect(global.fetch).toBeDefined();
        expect(jest.isMockFunction(global.fetch)).toBe(true);
    });
}); 