import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8080', 10),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/marwa_traders',
  jwtSecret: process.env.JWT_SECRET || 'marwa_traders_cms_jwt_secret_dev_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  
  // WhatsApp Configuration
  whatsapp: {
    apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    ownerNumber: process.env.WHATSAPP_OWNER_NUMBER || '919876543210',
  },

  // Optional Redis / BullMQ configuration
  redis: {
    host: process.env.REDIS_HOST || null,
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : null,
    password: process.env.REDIS_PASSWORD || undefined,
    isConfigured: !!(process.env.REDIS_HOST && process.env.REDIS_PORT),
  }
};
