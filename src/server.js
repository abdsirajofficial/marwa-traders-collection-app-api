import app from './app.js';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';

const startServer = async () => {
  await connectDB();

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(` MARWA TRADERS CMS - BACKEND RUNNING`);
    console.log(` Environment : ${config.env}`);
    console.log(` Port        : ${config.port}`);
    console.log(` Health Check: http://localhost:${config.port}/health`);
    console.log(` API Base    : http://localhost:${config.port}/api`);
    console.log(` Optional Redis: ${config.redis.isConfigured ? 'Enabled' : 'Disabled (Direct processing)'}`);
    console.log(`====================================================`);
  });

  const handleShutdown = (signal) => {
    console.log(`[Server] Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      console.log('[Server] HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
};

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
