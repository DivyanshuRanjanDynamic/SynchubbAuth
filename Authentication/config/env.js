import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from the root directory
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

// Export environment variables
export const env = {
    // Email Configuration
    EMAIL_USERNAME: process.env.EMAIL_USERNAME,
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
    EMAIL_SERVICE: process.env.EMAIL_SERVICE || 'gmail',
    CLIENT_URL: process.env.CLIENT_URL,

    // Server Configuration
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 8000,
    SERVER_URL: process.env.SERVER_URL || 'http://localhost:8000',

    // Database Configuration
    MONGO_URI: process.env.MONGO_URI,

    // Session Configuration
    SESSION_SECRET: process.env.SESSION_SECRET,

    // OAuth Configuration
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,

    // JWT Configuration
    ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || '1h',
    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
    REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || '5d',
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,

    // Redis Configuration
    REDIS_URL: process.env.REDIS_URL,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    REDIS_DB: process.env.REDIS_DB || '0'
};

// Log environment variables for debugging
console.log('Environment Variables:', {
    EMAIL_USERNAME: env.EMAIL_USERNAME,
    hasEmailPassword: !!env.EMAIL_PASSWORD,
    CLIENT_URL: env.CLIENT_URL,
    NODE_ENV: env.NODE_ENV
}); 