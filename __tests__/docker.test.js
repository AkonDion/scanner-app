import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';

const execAsync = promisify(exec);

const waitForContainer = async (port, retries = 5, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(`http://localhost:${port}/health`);
            if (response.ok) {
                return true;
            }
        } catch (error) {
            console.log(`Attempt ${i + 1}/${retries}: Container not ready yet...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error('Container failed to start properly');
};

describe('Docker Container Tests', () => {
    let containerId;

    beforeAll(async () => {
        // Clean up any existing containers and images
        try {
            await execAsync('docker ps -aq | xargs -r docker rm -f');
            await execAsync('docker images scanner-app-test -q | xargs -r docker rmi -f');
        } catch (error) {
            console.error('Error during initial cleanup:', error);
        }
        // Build the Docker image
        await execAsync('docker build -t scanner-app-test .');
    });

    afterEach(async () => {
        // Clean up containers after each test
        try {
            await execAsync('docker ps -aq | xargs -r docker rm -f');
        } catch (error) {
            console.error('Error cleaning up containers:', error);
        }
    });

    afterAll(async () => {
        // Clean up the image after all tests
        try {
            await execAsync('docker ps -aq | xargs -r docker rm -f');
            await execAsync('docker images scanner-app-test -q | xargs -r docker rmi -f');
        } catch (error) {
            console.error('Error during final cleanup:', error);
        }
    });

    test('should expose correct port', async () => {
        const { stdout } = await execAsync('docker run -d -p 3003:3001 scanner-app-test');
        containerId = stdout.trim();
        await waitForContainer(3003);
        const response = await fetch('http://localhost:3003/health');
        expect(response.ok).toBe(true);
    }, 30000);

    test('should have correct environment variables', async () => {
        const { stdout } = await execAsync('docker run -d scanner-app-test');
        containerId = stdout.trim();
        await new Promise(resolve => setTimeout(resolve, 2000));
        const { stdout: envOutput } = await execAsync(`docker exec ${containerId} env`);
        expect(envOutput).toContain('NODE_ENV=production');
        expect(envOutput).toContain('PORT=3001');
    }, 30000);

    test('should have all required dependencies installed', async () => {
        const { stdout } = await execAsync('docker run -d scanner-app-test');
        containerId = stdout.trim();
        await new Promise(resolve => setTimeout(resolve, 2000));
        const { stdout: npmOutput } = await execAsync(`docker exec ${containerId} npm list`);
        expect(npmOutput).toContain('express@');
        expect(npmOutput).toContain('cors@');
        expect(npmOutput).toContain('helmet@');
    }, 30000);

    test('should have health check endpoint working', async () => {
        const { stdout } = await execAsync('docker run -d -p 3003:3001 scanner-app-test');
        containerId = stdout.trim();
        await waitForContainer(3003);
        const response = await fetch('http://localhost:3003/health');
        const data = await response.json();
        expect(data.status).toBe('ok');
    }, 30000);
}); 