import mongoose from 'mongoose';
import { config } from './index.js';

export const connectDB = async (customUri = null) => {
  try {
    const uri = customUri || config.mongodbUri;
    const conn = await mongoose.connect(uri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    if (config.env === 'production') {
      process.exit(1);
    }
  }
};

export const closeDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('[MongoDB] Connection closed.');
  } catch (error) {
    console.error('[MongoDB] Error closing connection:', error.message);
  }
};
