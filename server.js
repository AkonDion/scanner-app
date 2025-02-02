import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import config from './config.js';
import fetch from 'node-fetch';

const app = express();
const port = process.env.PORT || 3001;

// Store token in memory (for simplicity)
let tokenStore = {
    accessToken: null,
    tokenExpiry: null
};

// Configure CORS for development
const corsOptions = {
    origin: ['http://localhost:8080', 'http://192.168.0.100:8080'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// Middleware to refresh token if needed
async function ensureValidToken(req, res, next) {
    try {
        if (!tokenStore.accessToken || !tokenStore.tokenExpiry || Date.now() >= (tokenStore.tokenExpiry - 60000)) {
            const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    refresh_token: config.ZOHO_REFRESH_TOKEN,
                    client_id: config.ZOHO_CLIENT_ID,
                    client_secret: config.ZOHO_CLIENT_SECRET,
                    grant_type: 'refresh_token'
                })
            });

            if (!response.ok) {
                throw new Error(`Token refresh failed: ${response.status}`);
            }

            const data = await response.json();
            tokenStore.accessToken = data.access_token;
            tokenStore.tokenExpiry = Date.now() + (data.expires_in * 1000);
        }
        
        req.zohoToken = tokenStore.accessToken;
        next();
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ error: 'Failed to refresh token' });
    }
}

// Proxy middleware options
const zohoProxyOptions = {
    target: 'https://www.zohoapis.com',
    changeOrigin: true,
    pathRewrite: {
        '^/api/zoho/deals(/.*)?$': (path, req) => {
            // For PUT requests, append the deal ID to the path
            if (req.method === 'PUT' && req.body && req.body.data && req.body.data[0]) {
                return `/crm/v2/Deals/${req.body.data[0].id}`;
            }
            // For other requests (like GET), use the standard path
            return '/crm/v2/Deals';
        }
    },
    onProxyReq: (proxyReq, req) => {
        // Remove all variations of authorization headers
        const headersToRemove = [
            'authorization',
            'Authorization',
            'AUTHORIZATION'
        ];
        
        headersToRemove.forEach(header => {
            proxyReq.removeHeader(header);
            delete req.headers[header];
        });

        // Set the authorization header with the token using Bearer format
        if (req.zohoToken) {
            proxyReq.setHeader('Authorization', `Bearer ${req.zohoToken}`);
        }

        // Set content type and accept headers
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Accept', 'application/json');

        // Log the final headers for debugging
        console.log('\n=== Final Request Headers ===');
        console.log('Headers:', {
            ...proxyReq.getHeaders(),
            Authorization: 'Bearer [hidden]'
        });
        console.log('========================\n');
    }
};

// Use proxy middleware
app.use('/zoho', ensureValidToken, createProxyMiddleware(zohoProxyOptions));

// Start server
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${port}`);
});

export default app; 