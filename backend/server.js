import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import config from './config.js';
import fetch from 'node-fetch';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import zlib from 'zlib';
import { promisify } from 'util';

const app = express();
const port = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Enable trust proxy only for our Nginx reverse proxy
app.set('trust proxy', 'loopback, linklocal, uniquelocal');

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            mediaSrc: ["'self'", "blob:"],
            connectSrc: ["'self'", "https://www.zohoapis.com"],
            frameSrc: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false
}));
app.use((req, res, next) => {
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});
app.use(helmet.frameguard({ action: 'DENY' }));
app.use(compression());

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, etc.)
        if (!origin) {
            callback(null, true);
            return;
        }
        const allowedOrigins = [
            'http://localhost',
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002',
            'http://localhost:3003',
            'http://192.168.0.100:8080',
            'https://192.168.0.100:8080'
        ];
        callback(null, allowedOrigins.includes(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin'
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range']
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Token management with encryption
const tokenStore = {
    accessToken: null,
    tokenExpiry: null
};

// Rate limiter configuration
export const limiter = rateLimit({
    windowMs: process.env.NODE_ENV === 'test' ? 1000 : 15 * 60 * 1000,  // 1 second in test mode
    max: process.env.NODE_ENV === 'test' ? 3 : 100,  // 3 requests per second in test mode
    skipFailedRequests: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many requests, please try again later.'
        });
    }
});

// Health check endpoint (no rate limiting)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Test routes
if (isTest) {
    // API proxy test route (no rate limiting)
    app.get('/api/test', (req, res) => {
        res.json({ proxied: true });
    });
    
    // Rate limited test route
    app.get('/api/test-limit', limiter, (req, res) => {
        res.json({ message: 'Rate limited endpoint' });
    });
    
    app.get('/api/error', (req, res) => {
        res.status(502).json({ error: 'Proxy Error' });
    });
}

// Production routes
if (!isTest) {
    app.use('/api', limiter, (req, res, next) => {
        console.log('API Request:', req.method, req.path, req.query);
        if (req.path === '/test') {
            res.json({ proxied: true });
        } else if (req.path === '/error') {
            res.status(502).json({ error: 'Bad Gateway' });
        } else if (req.path.startsWith('/zoho')) {
            console.log('Proxying Zoho request:', req.method, req.path);
            ensureValidToken(req, res, () => {
                createProxyMiddleware(zohoProxyOptions)(req, res, next);
            });
        } else {
            next();
        }
    });
}

// Error handling routes (no rate limiting)
app.get('/error', (req, res) => {
    throw new Error('Test error');
});

// 404 handler for undefined routes (no rate limiting)
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handler (no rate limiting)
app.use((err, req, res, next) => {
    console.error(err);
    if (err instanceof Error) {
        res.status(500).json({ error: err.message });
    } else {
        res.status(500).json({ error: 'An unexpected error occurred' });
    }
});

// Token refresh middleware
async function ensureValidToken(req, res, next) {
    try {
        console.log('Current token state:', {
            hasToken: !!tokenStore.accessToken,
            tokenExpiry: tokenStore.tokenExpiry,
            currentTime: Date.now()
        });

        if (!tokenStore.accessToken || !tokenStore.tokenExpiry || Date.now() >= (tokenStore.tokenExpiry - 60000)) {
            console.log('Refreshing token with:', {
                refresh_token: config.ZOHO_REFRESH_TOKEN,
                client_id: config.ZOHO_CLIENT_ID,
                client_secret: '***'
            });

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

            console.log('Token refresh response status:', response.status);
            const responseText = await response.text();
            console.log('Token refresh response:', responseText);

            if (!response.ok) {
                throw new Error(`Token refresh failed: ${response.status} - ${responseText}`);
            }

            const data = JSON.parse(responseText);
            tokenStore.accessToken = data.access_token;
            tokenStore.tokenExpiry = Date.now() + (data.expires_in * 1000);
            console.log('Token refreshed successfully');
        }
        
        req.zohoToken = tokenStore.accessToken;
        next();
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ 
            error: isProduction ? 'Authentication failed' : error.message 
        });
    }
}

// Proxy configuration
const gunzip = promisify(zlib.gunzip);

const zohoProxyOptions = {
    target: 'https://www.zohoapis.com',
    changeOrigin: true,
    pathRewrite: {
        '^/api/zoho/deals(/.*)?$': '/crm/v2/Deals$1'
    },
    onProxyReq: (proxyReq, req) => {
        // First, remove any existing headers we want to control
        proxyReq.removeHeader('authorization');
        proxyReq.removeHeader('Authorization');
        proxyReq.removeHeader('AUTHORIZATION');
        proxyReq.removeHeader('connection');
        proxyReq.removeHeader('Connection');
        proxyReq.removeHeader('cache-control');
        proxyReq.removeHeader('pragma');
        
        delete req.headers['authorization'];
        delete req.headers['Authorization'];
        delete req.headers['AUTHORIZATION'];
        delete req.headers['connection'];
        delete req.headers['Connection'];
        delete req.headers['cache-control'];
        delete req.headers['pragma'];

        // Set the authorization header with the appropriate format based on method
        if (req.zohoToken) {
            const authHeader = req.method === 'PUT' 
                ? `Bearer ${req.zohoToken}`
                : `Zoho-oauthtoken ${req.zohoToken}`;
            proxyReq.setHeader('Authorization', authHeader);
        }

        // Set content type and accept headers
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Accept', 'application/json');

        // Set connection and caching headers to match Postman
        proxyReq.setHeader('Connection', 'keep-alive');
        proxyReq.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        proxyReq.setHeader('Pragma', 'no-cache');

        // Log headers for debugging
        console.log('Final proxy request headers:', {
            'Content-Type': proxyReq.getHeader('Content-Type'),
            'Accept': proxyReq.getHeader('Accept'),
            'Authorization': proxyReq.getHeader('Authorization'),
            'Connection': proxyReq.getHeader('Connection'),
            'Cache-Control': proxyReq.getHeader('Cache-Control'),
            'Pragma': proxyReq.getHeader('Pragma')
        });
    },
    onProxyRes: async (proxyRes, req, res) => {
        const chunks = [];

        console.log('\n=== Zoho API Response Headers ===');
        console.log('Status:', proxyRes.statusCode, proxyRes.statusMessage);
        console.log('Headers:', proxyRes.headers);
        console.log('==============================\n');

        proxyRes.on('data', chunk => chunks.push(chunk));

        proxyRes.on('end', async () => {
            try {
                const buffer = Buffer.concat(chunks);
                let data = buffer;

                if (proxyRes.headers['content-encoding'] === 'gzip') {
                    try {
                        data = await gunzip(buffer);
                    } catch (err) {
                        console.error('Error decompressing response:', err);
                        return;
                    }
                }

                const bodyStr = data.toString('utf8');
                try {
                    const parsedBody = JSON.parse(bodyStr);
                    console.log('\n=== Zoho API Response Body ===');
                    console.log(JSON.stringify(parsedBody, null, 2));
                    console.log('==============================\n');
                } catch (err) {
                    console.error('Error parsing JSON:', err);
                }
            } catch (err) {
                console.error('Error processing response:', err);
            }
        });
    },
    onError: (err, req, res) => {
        console.error('\n=== Zoho API Proxy Error ===');
        console.error('Error:', err.message);
        console.error('Stack:', err.stack);
        console.error('Request URL:', req.originalUrl);
        console.error('Request Method:', req.method);
        console.error('==============================\n');
        
        res.status(502).json({
            error: isProduction ? 'Service temporarily unavailable' : err.message
        });
    }
};

// Use proxy middleware for /api/zoho path
app.use('/api/zoho', ensureValidToken, createProxyMiddleware(zohoProxyOptions));

// Export the app for testing
export default app;

// Start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
    app.listen(port, '0.0.0.0', () => {
        console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${port}`);
    });
} 