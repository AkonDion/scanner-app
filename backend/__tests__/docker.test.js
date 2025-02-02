import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';

const execAsync = promisify(exec);

// Helper function to wait for container health
async function waitForContainer(port, maxAttempts = 15) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            console.log(`Attempt ${i + 1}/${maxAttempts}: Checking container health...`);
            const response = await fetch(`http://localhost:${port}/health`);
            if (response.ok) {
                console.log('Container is healthy!');
                return true;
            }
        } catch (error) {
            console.log(`Container not ready yet, waiting... (${error.message})`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    throw new Error('Container failed to become healthy');
}

describe('Docker Container Tests', () => {
    beforeAll(async () => {
        // Clean up any existing containers and images
        try {
            console.log('Cleaning up existing containers and images...');
            await execAsync('docker ps -aq | xargs -r docker rm -f');
            await execAsync('docker images scanner-app-test -q | xargs -r docker rmi -f');
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }, 20000);

    afterAll(async () => {
        // Clean up after tests
        try {
            console.log('Final cleanup of containers and images...');
            await execAsync('docker ps -aq | xargs -r docker rm -f');
            await execAsync('docker images scanner-app-test -q | xargs -r docker rmi -f');
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }, 20000);

    beforeEach(async () => {
        // Build the test image before each test
        try {
            console.log('Building Docker image...');
            await execAsync('docker build -t scanner-app-test .');
        } catch (error) {
            console.error('Error building test image:', error);
            throw error;
        }
    }, 60000);

    afterEach(async () => {
        // Stop and remove any containers after each test
        try {
            console.log('Cleaning up containers after test...');
            await execAsync('docker ps -aq | xargs -r docker rm -f');
        } catch (error) {
            console.error('Error stopping containers:', error);
        }
    }, 20000);

    test('should start container successfully', async () => {
        console.log('Starting container...');
        const { stdout } = await execAsync('docker run -d -p 3003:3001 scanner-app-test');
        const containerId = stdout.trim();
        expect(containerId).toBeTruthy();
        await waitForContainer(3003);
    }, 60000);

    test('should expose correct port', async () => {
        console.log('Testing port exposure...');
        const { stdout } = await execAsync('docker run -d -p 3003:3001 scanner-app-test');
        const containerId = stdout.trim();
        await waitForContainer(3003);
        const response = await fetch('http://localhost:3003/health');
        expect(response.ok).toBe(true);
    }, 60000);

    test('should have correct environment variables', async () => {
        console.log('Testing environment variables...');
        const { stdout } = await execAsync('docker run -d -p 3003:3001 scanner-app-test');
        const containerId = stdout.trim();
        await waitForContainer(3003);
        const { stdout: envOutput } = await execAsync(`docker exec ${containerId} env`);
        expect(envOutput).toContain('NODE_ENV=production');
        expect(envOutput).toContain('PORT=3001');
    }, 60000);

    test('should have all required dependencies installed', async () => {
        console.log('Testing dependencies...');
        const { stdout } = await execAsync('docker run -d -p 3003:3001 scanner-app-test');
        const containerId = stdout.trim();
        await waitForContainer(3003);
        const { stdout: npmOutput } = await execAsync(`docker exec ${containerId} npm list --depth=0`);
        expect(npmOutput).toContain('express@');
        expect(npmOutput).toContain('cors@');
        expect(npmOutput).toContain('helmet@');
    }, 60000);

    test('should have health check endpoint working', async () => {
        console.log('Testing health check endpoint...');
        const { stdout } = await execAsync('docker run -d -p 3003:3001 scanner-app-test');
        const containerId = stdout.trim();
        await waitForContainer(3003);
        const response = await fetch('http://localhost:3003/health');
        const data = await response.json();
        expect(data.status).toBe('ok');
    }, 60000);

    test('should handle graceful shutdown', async () => {
        console.log('Testing graceful shutdown...');
        const { stdout } = await execAsync('docker run -d -p 3003:3001 scanner-app-test');
        const containerId = stdout.trim();
        await waitForContainer(3003);
        const stopOutput = await execAsync(`docker stop ${containerId}`);
        expect(stopOutput.stdout).toBeTruthy();
    }, 60000);
}); 