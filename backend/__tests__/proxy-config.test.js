import { createProxyMiddleware } from 'http-proxy-middleware';
import express from 'express';
import request from 'supertest';

describe('Zoho Proxy Configuration Tests', () => {
    let app;
    let mockProxyMiddleware;

    beforeEach(() => {
        app = express();
        
        // Mock proxy middleware
        mockProxyMiddleware = jest.fn((req, res) => {
            console.log('\n=== Mock Proxy Called ===');
            console.log('Method:', req.method);
            console.log('Path:', req.path);
            console.log('Headers:', req.headers);
            if (req.body) {
                console.log('Body:', JSON.stringify(req.body, null, 2));
            }
            console.log('========================\n');

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

        // Mock createProxyMiddleware
        jest.spyOn(require('http-proxy-middleware'), 'createProxyMiddleware')
            .mockImplementation(() => mockProxyMiddleware);

        // Configure proxy options
        const proxyOptions = {
            target: 'https://www.zohoapis.com',
            changeOrigin: true,
            pathRewrite: {
                '^/api/zoho/deals(/.*)?$': '/crm/v2/Deals$1'
            },
            onProxyReq: (proxyReq, req) => {
                // Log original request details
                console.log('\n=== Original Request ===');
                console.log('Original URL:', req.originalUrl);
                console.log('Base URL:', req.baseUrl);
                console.log('Path:', req.path);
                console.log('======================\n');

                if (req.zohoToken) {
                    proxyReq.setHeader('Authorization', `Bearer ${req.zohoToken}`);
                }
                proxyReq.setHeader('Content-Type', 'application/json');
                proxyReq.setHeader('Accept', 'application/json');

                // For POST/PUT requests, write the body
                if ((req.method === 'POST' || req.method === 'PUT') && req.body) {
                    const bodyData = JSON.stringify(req.body);
                    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                    proxyReq.write(bodyData);
                }
            }
        };

        // Add middleware to simulate token and parse JSON
        app.use(express.json());
        app.use((req, res, next) => {
            req.zohoToken = 'test-token';
            next();
        });

        // Mount proxy middleware
        app.use('/api/zoho', createProxyMiddleware(proxyOptions));

        // Add error handling
        app.use((err, req, res, next) => {
            console.error('Error:', err);
            res.status(500).json({ error: err.message });
        });
    });

    describe('GET requests', () => {
        test('should proxy GET request correctly', async () => {
            const response = await request(app)
                .get('/api/zoho/deals')
                .set('Accept', 'application/json');

            expect(mockProxyMiddleware).toHaveBeenCalled();
            expect(response.status).toBe(200);
            expect(response.body.data[0].status).toBe('success');
            expect(response.body.data[0].message).toBe('record fetched');

            const proxyCall = mockProxyMiddleware.mock.calls[0][0];
            expect(proxyCall.originalUrl).toBe('/api/zoho/deals');
            expect(proxyCall.baseUrl).toBe('/api/zoho');
            expect(proxyCall.path).toBe('/deals');
            expect(proxyCall.method).toBe('GET');
        });
    });

    describe('PUT requests', () => {
        test('should proxy PUT request with correct body', async () => {
            const requestBody = {
                data: [{
                    id: "5665332000014936002",
                    Serial_1: "2310261085",
                    Serial_2: "2310261085",
                    Serial_3: "2310261085"
                }]
            };

            const response = await request(app)
                .put('/api/zoho/deals')
                .set('Content-Type', 'application/json')
                .send(requestBody);

            expect(mockProxyMiddleware).toHaveBeenCalled();
            expect(response.status).toBe(200);
            expect(response.body.data[0].status).toBe('success');
            expect(response.body.data[0].message).toBe('record updated');

            const proxyCall = mockProxyMiddleware.mock.calls[0][0];
            expect(proxyCall.originalUrl).toBe('/api/zoho/deals');
            expect(proxyCall.baseUrl).toBe('/api/zoho');
            expect(proxyCall.path).toBe('/deals');
            expect(proxyCall.method).toBe('PUT');
            expect(proxyCall.body).toEqual(requestBody);
        });
    });

    describe('Path handling', () => {
        test('should preserve original path in proxy call', async () => {
            const response = await request(app)
                .get('/api/zoho/deals')
                .set('Accept', 'application/json');

            const proxyCall = mockProxyMiddleware.mock.calls[0][0];
            expect(proxyCall.originalUrl).toBe('/api/zoho/deals');
            expect(proxyCall.baseUrl).toBe('/api/zoho');
            expect(proxyCall.path).toBe('/deals');
        });

        test('should handle path parameters correctly', async () => {
            const response = await request(app)
                .get('/api/zoho/deals/123456')
                .set('Accept', 'application/json');

            const proxyCall = mockProxyMiddleware.mock.calls[0][0];
            expect(proxyCall.originalUrl).toBe('/api/zoho/deals/123456');
            expect(proxyCall.path).toBe('/deals/123456');
        });
    });
}); 