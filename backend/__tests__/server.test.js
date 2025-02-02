const request = require('supertest');

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3002';

// Mock modules
jest.mock('../config.js', () => ({
    __esModule: true,
    default: {
        ZOHO_REFRESH_TOKEN: 'test-refresh-token',
        ZOHO_CLIENT_ID: 'test-client-id',
        ZOHO_CLIENT_SECRET: 'test-client-secret',
        PORT: 3002,
        NODE_ENV: 'test'
    }
}));

jest.mock('http-proxy-middleware', () => ({
    createProxyMiddleware: jest.fn((options) => {
        return (req, res, next) => {
            if (req.path.startsWith('/api')) {
                res.json({ proxied: true });
            } else {
                next();
            }
        };
    })
}));

// Mock fetch
global.fetch = jest.fn();

describe('Server Tests', () => {
    let app;
    let server;
    let limiter;

    beforeAll(async () => {
        const serverModule = await import('../server.js');
        app = serverModule.default;
        limiter = serverModule.limiter;
        server = app.listen(3002);
    });

    afterAll((done) => {
        if (server) {
            server.close(done);
        } else {
            done();
        }
    });

    beforeEach(() => {
        // Reset rate limiter before each test
        if (limiter && limiter.resetKey) {
            limiter.resetKey();
        }
    });

    describe('Health Check', () => {
        test('GET /health should return 200', async () => {
            const response = await request(app).get('/health');
            expect(response.status).toBe(200);
            expect(response.body).toEqual({ status: 'ok' });
        });
    });

    describe('Security Headers', () => {
        test('should set security headers', async () => {
            const response = await request(app).get('/health');
            expect(response.headers['x-content-type-options']).toBe('nosniff');
            expect(response.headers['x-frame-options']).toBe('DENY');
            expect(response.headers['x-xss-protection']).toBe('1; mode=block');
        });
    });

    describe('CORS', () => {
        test('should allow CORS for allowed origins', async () => {
            const response = await request(app)
                .get('/health')
                .set('Origin', 'http://localhost:3000');
            expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
        });

        test('should block CORS for disallowed origins', async () => {
            const response = await request(app)
                .get('/health')
                .set('Origin', 'http://malicious-site.com');
            expect(response.headers['access-control-allow-origin']).toBeUndefined();
        });
    });

    describe('Rate Limiting', () => {
        test('should limit repeated requests', async () => {
            // Make multiple requests to the rate-limited endpoint
            const requests = Array(5).fill().map(() => 
                request(app).get('/api/test-limit')
            );
            
            // Wait for the first batch of requests to complete
            const responses = await Promise.all(requests);
            
            // At least one request should be rate limited (we allow 3 requests per second)
            const tooManyRequests = responses.filter(r => r.status === 429);
            expect(tooManyRequests.length).toBeGreaterThan(0);
            
            // Some requests should succeed
            const successRequests = responses.filter(r => r.status === 200);
            expect(successRequests.length).toBe(3);
        });
    });

    describe('API Proxy', () => {
        test('should proxy API requests', async () => {
            const response = await request(app).get('/api/test');
            expect(response.body).toEqual({ proxied: true });
        });

        test('should handle proxy errors', async () => {
            const response = await request(app).get('/api/error');
            expect(response.status).toBe(502);
        });
    });

    describe('Error Handling', () => {
        test('should handle 404 errors', async () => {
            const response = await request(app).get('/nonexistent');
            expect(response.status).toBe(404);
        });

        test('should handle server errors', async () => {
            const response = await request(app).get('/error');
            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('error');
        });
    });

    describe('Zoho API Integration', () => {
        beforeEach(() => {
            // Reset fetch mock
            global.fetch.mockReset();
            
            // Mock successful token refresh
            global.fetch.mockImplementationOnce(() => 
                Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve(JSON.stringify({
                        access_token: 'test-access-token',
                        expires_in: 3600
                    }))
                })
            );
        });

        test('PUT request should match exact Postman configuration', async () => {
            const dealId = '5665332000014936002';
            const updateData = {
                data: [{
                    id: dealId,
                    Serial_1: "2310261085",
                    Serial_2: "2310261085",
                    Serial_3: "2310261085"
                }]
            };

            // Mock the proxy middleware
            const proxyMiddleware = require('http-proxy-middleware');
            const proxyCall = proxyMiddleware.createProxyMiddleware.mock.calls[0][0];
            
            const mockProxyReq = {
                headers: new Map(),
                setHeader: jest.fn((name, value) => mockProxyReq.headers.set(name.toLowerCase(), value)),
                getHeader: jest.fn(name => mockProxyReq.headers.get(name.toLowerCase())),
                removeHeader: jest.fn(name => mockProxyReq.headers.delete(name.toLowerCase()))
            };

            const mockReq = {
                method: 'PUT',
                headers: {
                    'content-type': 'application/json',
                    'accept': 'application/json'
                },
                zohoToken: 'test-access-token'
            };

            // Execute the proxy request configuration
            proxyCall.onProxyReq(mockProxyReq, mockReq);

            // Verify exact headers from Postman
            expect(mockProxyReq.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
            expect(mockProxyReq.setHeader).toHaveBeenCalledWith('Accept', 'application/json');
            expect(mockProxyReq.setHeader).toHaveBeenCalledWith('Authorization', 'Bearer test-access-token');
            expect(mockProxyReq.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
            expect(mockProxyReq.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            expect(mockProxyReq.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
        });

        test('GET request should still work with different auth', async () => {
            const proxyMiddleware = require('http-proxy-middleware');
            const proxyCall = proxyMiddleware.createProxyMiddleware.mock.calls[0][0];
            
            const mockProxyReq = {
                headers: new Map(),
                setHeader: jest.fn((name, value) => mockProxyReq.headers.set(name.toLowerCase(), value)),
                getHeader: jest.fn(name => mockProxyReq.headers.get(name.toLowerCase())),
                removeHeader: jest.fn(name => mockProxyReq.headers.delete(name.toLowerCase()))
            };

            const mockReq = {
                method: 'GET',
                headers: {
                    'content-type': 'application/json',
                    'accept': 'application/json'
                },
                zohoToken: 'test-access-token'
            };

            proxyCall.onProxyReq(mockProxyReq, mockReq);

            // Verify GET request still uses correct auth
            expect(mockProxyReq.setHeader).toHaveBeenCalledWith('Authorization', 'Zoho-oauthtoken test-access-token');
            expect(mockProxyReq.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
            expect(mockProxyReq.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
        });
    });
}); 