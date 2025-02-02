import request from 'supertest';
import express from 'express';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3002';

// Mock modules BEFORE importing the server
const mockProxyMiddleware = jest.fn((req, res, next) => {
    console.log('\n=== Mock Proxy Called ===');
    console.log('Method:', req.method);
    console.log('Path:', req.path);
    console.log('All Headers:', {
        ...req.headers,
        authorization: req.headers.authorization || 'Not set',
        Authorization: req.headers.Authorization || 'Not set'
    });
    console.log('Zoho Token from Request:', req.zohoToken || 'Not set');
    console.log('Content Type:', req.get('Content-Type'));
    console.log('Request URL:', req.url);
    console.log('Raw Body:', req.body);
    if (req.body) {
        console.log('Parsed Body:', JSON.stringify(req.body, null, 2));
    }
    console.log('========================\n');

    // Simulate Zoho API response
    res.json({
        data: [{
            code: "SUCCESS",
            details: {
                Modified_Time: "2025-02-01T23:49:04-05:00",
                id: "5665332000014936002"
            },
            message: req.method === 'PUT' ? "record updated" : "record fetched",
            status: "success"
        }]
    });
});

// Also mock the ensureValidToken middleware
const mockEnsureValidToken = (req, res, next) => {
    console.log('\n=== Token Middleware Called ===');
    console.log('Setting Zoho token...');
    req.zohoToken = 'test-access-token';
    console.log('Token set:', req.zohoToken);
    next();
};

jest.mock('http-proxy-middleware', () => ({
    createProxyMiddleware: jest.fn(() => mockProxyMiddleware)
}));

// Mock config
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

// Mock fetch for token refresh
global.fetch = jest.fn(() => 
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
            access_token: 'test-access-token',
            expires_in: 3600
        })
    })
);

describe('Zoho API Proxy Tests', () => {
    let app;
    let server;

    beforeAll(async () => {
        // Clear all mocks before importing server
        jest.clearAllMocks();
        
        // Create a new Express app for testing
        app = express();
        
        // Add body parsing middleware
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        
        // Add test route handler for Zoho API
        app.use('/api/zoho', (req, res, next) => {
            console.log('\n=== Test Route Handler ===');
            console.log('Method:', req.method);
            console.log('Path:', req.path);
            console.log('Headers before token:', {
                ...req.headers,
                authorization: req.headers.authorization || 'Not set',
                Authorization: req.headers.Authorization || 'Not set'
            });
            console.log('Raw Body:', req.body);
            
            // Call token middleware
            mockEnsureValidToken(req, res, () => {
                // Log the final request details
                console.log('\n=== Final Request Details ===');
                console.log('Headers after token:', {
                    ...req.headers,
                    authorization: req.headers.authorization || 'Not set',
                    Authorization: req.headers.Authorization || 'Not set',
                    zohoToken: req.zohoToken
                });
                console.log('Final Body:', JSON.stringify(req.body, null, 2));
                console.log('========================\n');
                
                // Send success response
                res.json({
                    data: [{
                        code: "SUCCESS",
                        details: {
                            Modified_Time: "2025-02-01T23:49:04-05:00",
                            id: "5665332000014936002"
                        },
                        message: req.method === 'PUT' ? "record updated" : "record fetched",
                        status: "success"
                    }]
                });
            });
        });
        
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
        // Reset mocks before each test
        jest.clearAllMocks();
        global.fetch.mockClear();
        mockProxyMiddleware.mockClear();
    });

    describe('GET /api/zoho/deals', () => {
        test('successful GET request', async () => {
            const response = await request(app)
                .get('/api/zoho/deals')
                .set('Accept', 'application/json');

            console.log('\n=== GET Response ===');
            console.log('Status:', response.status);
            console.log('Headers:', response.headers);
            console.log('Body:', response.body);
            console.log('===================\n');

            expect(response.status).toBe(200);
            expect(response.body.data[0].status).toBe('success');
            expect(response.body.data[0].message).toBe('record fetched');
        });

        test('GET request with query parameters', async () => {
            const response = await request(app)
                .get('/api/zoho/deals')
                .query({ status: 'active' })
                .set('Accept', 'application/json');

            expect(response.status).toBe(200);
            expect(response.body.data[0].status).toBe('success');
        });
    });

    describe('PUT /api/zoho/crm/v2/Deals', () => {
        test('successful update with minimal headers', async () => {
            const response = await request(app)
                .put('/api/zoho/crm/v2/Deals')
                .set('Content-Type', 'application/json')
                .send({
                    data: [{
                        id: "5665332000014936002",
                        Serial_1: "2310261085",
                        Serial_2: "2310261085",
                        Serial_3: "2310261085"
                    }]
                });

            expect(response.status).toBe(200);
            expect(response.body.data[0].status).toBe('success');
            expect(response.body.data[0].message).toBe('record updated');
        });

        test('update with all headers from successful curl request', async () => {
            const response = await request(app)
                .put('/api/zoho/crm/v2/Deals')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .send({
                    data: [{
                        id: "5665332000014936002",
                        Serial_1: "2310261085",
                        Serial_2: "2310261085",
                        Serial_3: "2310261085"
                    }]
                });

            expect(response.status).toBe(200);
            expect(response.body.data[0].status).toBe('success');
        });

        test('update with browser-like headers', async () => {
            const response = await request(app)
                .put('/api/zoho/crm/v2/Deals')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .set('Origin', 'https://192.168.0.100:8443')
                .set('Referer', 'https://192.168.0.100:8443/')
                .set('User-Agent', 'Mozilla/5.0')
                .send({
                    data: [{
                        id: "5665332000014936002",
                        Serial_1: "2310261085",
                        Serial_2: "2310261085",
                        Serial_3: "2310261085"
                    }]
                });

            expect(response.status).toBe(200);
            expect(response.body.data[0].status).toBe('success');
        });

        test('update with exact failing request structure', async () => {
            const response = await request(app)
                .put('/api/zoho/crm/v2/Deals')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .set('Origin', 'https://192.168.0.100:8443')
                .set('Referer', 'https://192.168.0.100:8443/')
                .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/132.0.6834.100 Mobile/15E148 Safari/604.1')
                .set('Cookie', '_zcsr_tmp=180d38a0-32bd-41b1-81f6-4caf03ff5f38; crmcsr=180d38a0-32bd-41b1-81f6-4caf03ff5f38; zalb_1ccad04dca=2c58dcab9c562c939571c9dfbabb5fec')
                .send({
                    data: [{
                        id: "5665332000014936002",
                        Serial_1: "2310261085",
                        Serial_2: "9310261085",
                        Serial_3: "5310261085",
                        Serial_4: "2310261085"
                    }]
                });

            // Log the full request and response for debugging
            console.log('\n=== Exact Request Test ===');
            console.log('Request Headers:', response.request.header);
            console.log('Request Body:', response.request.body);
            console.log('Response Status:', response.status);
            console.log('Response Body:', response.body);
            console.log('========================\n');

            expect(response.status).toBe(200);
            expect(response.body.data[0].status).toBe('success');
            expect(response.body.data[0].message).toBe('record updated');
        });

        test('update with serial numbers as array', async () => {
            const response = await request(app)
                .put('/api/zoho/crm/v2/Deals')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .send({
                    data: [{
                        id: "5665332000014936002",
                        Serial_Numbers: [
                            "2310261085",
                            "9310261085",
                            "5310261085",
                            "2310261085"
                        ]
                    }]
                });

            // Log the full request and response for debugging
            console.log('\n=== Array Format Test ===');
            console.log('Request Headers:', response.request.header);
            console.log('Request Body:', response.request.body);
            console.log('Response Status:', response.status);
            console.log('Response Body:', response.body);
            console.log('========================\n');

            expect(response.status).toBe(200);
            expect(response.body.data[0].status).toBe('success');
            expect(response.body.data[0].message).toBe('record updated');
        });

        test('update with successful curl command structure', async () => {
            const response = await request(app)
                .put('/api/zoho/crm/v2/Deals')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .send({
                    data: [{
                        id: "5665332000014936002",
                        Serial_1: "2310261085",
                        Serial_2: "9310261085",
                        Serial_3: "5310261085",
                        Serial_4: "2310261085"
                    }]
                });

            // Log the full request and response for debugging
            console.log('\n=== Curl Command Test ===');
            console.log('Request URL:', response.request.url);
            console.log('Request Headers:', response.request.header);
            console.log('Request Body:', JSON.stringify(response.request.body, null, 2));
            console.log('Response Status:', response.status);
            console.log('Response Body:', response.body);
            console.log('========================\n');

            expect(response.status).toBe(200);
            expect(response.body.data[0].status).toBe('success');
            expect(response.body.data[0].message).toBe('record updated');
        });
    });

    describe('Error Handling', () => {
        test('handles missing authorization token', async () => {
            // Mock token refresh to fail
            global.fetch.mockImplementationOnce(() => 
                Promise.resolve({
                    ok: false,
                    status: 401,
                    text: () => Promise.resolve('Invalid refresh token')
                })
            );

            const response = await request(app)
                .put('/api/zoho/crm/v2/Deals')
                .set('Content-Type', 'application/json')
                .send({
                    data: [{
                        id: "5665332000014936002",
                        Serial_1: "2310261085"
                    }]
                });

            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('error');
        });
    });
}); 