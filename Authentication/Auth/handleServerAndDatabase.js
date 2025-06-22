import { app } from "../app.js";
import connectDB from "./db/connectDB.js";
import dotenv from "dotenv";
import http from "http";
import fs from "fs";
import crypto from 'crypto';
import path from "path";
import { fileURLToPath } from 'url';
import cors from 'cors';
import { 
    limiter, 
    corsOptions, 
    helmetConfig, 
    initializeRedis,
    compressionMiddleware 
} from './config/security.js';

// Convert ES module URL to path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure environment variables with absolute path
const envPath = path.resolve(__dirname, '../../.env ');
dotenv.config({ path: envPath });

// Log environment variables for debugging
console.log('Environment Variables:', {
    EMAIL_USER: process.env.EMAIL_USERNAME,
    hasEmailPassword: !!process.env.EMAIL_PASSWORD,
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT
});

// SSL Path inside Auth Service (no longer needed for server startup on Render)
// const sslDir = path.join(__dirname,'server', 'ssl');
// const keyPath = path.join(sslDir, 'key.pem');
// const certPath = path.join(sslDir, 'cert.pem');

// Apply security middleware
app.use(helmetConfig);
app.use(limiter);
app.use(cors(corsOptions));
app.use(compressionMiddleware);


// Debug function to analyze certificate files (no longer directly used for server)
function debugCertificateFiles() {
    console.log('debugCertificateFiles is not active in production setup.');
    return {};
}

// Certificate generation (only for local development if needed, not for Render production)
const generateCertificatePair = async () => {
    console.log('generateCertificatePair is not active in production setup.');
    return {};
}

// Add health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Start server with HTTP (Render handles HTTPS)
const startServer = async () => {
    try {
        // Initialize Redis
        await initializeRedis();

        // Connect to MongoDB
        await connectDB();

        // No need to generate/read certificates for Render deployment
        // if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
        //     await generateCertificatePair();
        // }

        // Create a plain HTTP server
        const server = http.createServer(app);
        
        const port = process.env.PORT || 8000; // Render will provide PORT
        const host = '0.0.0.0'; // Bind to all interfaces for Render
        
        // Try to start the server
        try {
            await server.listen(port, host, () => {
                console.log(`Server running on http://${host}:${port} in ${process.env.NODE_ENV} mode`);
            });
        } catch (error) {
            console.error(`Failed to start server on ${host}:${port}:`, error);
            process.exit(1);
        }

        // Error handling
        server.on('error', (error) => {
            console.error('Server runtime error:', error);
            process.exit(1); // Exit on server errors
        });
    } catch(error) {
        console.error('Server startup failed:', error);
        process.exit(1);
    }
}

// Start the server
startServer();