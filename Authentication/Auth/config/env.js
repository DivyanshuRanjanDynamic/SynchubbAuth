import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define possible .env file locations
const envPaths = [
    path.resolve(__dirname, '../../../.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '.env')
];

// Try loading .env from multiple possible locations
let envLoaded = false;
for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
        console.log('Loaded environment variables from:', envPath);
        envLoaded = true;
        break;
    }
}

if (!envLoaded) {
    console.warn('No .env file found in any of the expected locations');
}

// Log environment variables for debugging
console.log('Environment Variables:', {
    EMAIL_USERNAME: process.env.EMAIL_USERNAME,
    hasEmailPassword: !!process.env.EMAIL_PASSWORD,
    CLIENT_URL: process.env.CLIENT_URL,
    NODE_ENV: process.env.NODE_ENV
});

// Export environment variables
export const env = {
    EMAIL_USERNAME: process.env.EMAIL_USERNAME,
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
    CLIENT_URL: process.env.CLIENT_URL,
    EMAIL_SERVICE: process.env.EMAIL_SERVICE || 'gmail'
};