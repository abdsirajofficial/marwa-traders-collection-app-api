import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes/index.js';
import { errorHandler } from './common/middlewares/error.middleware.js';
import { config } from './common/config/index.js';

const app = express();

// Security Middlewares
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (config.env !== 'test') {
  app.use(morgan('combined'));
}

// Health Check Endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Privacy Policy Endpoint for Meta Compliance
app.get('/privacy', (req, res) => {
  res.status(200).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><title>Marwa Traders Privacy Policy</title></head>
    <body style="font-family:sans-serif;max-width:800px;margin:40px auto;line-height:1.6;padding:0 20px;">
      <h1>Privacy Policy — Marwa Traders</h1>
      <p>Last updated: October 2026</p>
      <p>Marwa Traders uses the WhatsApp Business API solely to deliver transaction receipts and collection updates to registered customers and business owners.</p>
      <p>We do not sell, rent, or share customer contact information or transaction data with third parties.</p>
      <p>For questions or support, contact Marwa Traders management.</p>
    </body>
    </html>
  `);
});

// Mount Routes under /api
app.use('/api', routes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} not found`,
  });
});

// Central Error Handler
app.use(errorHandler);

export default app;
