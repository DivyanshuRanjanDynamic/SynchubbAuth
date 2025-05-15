import { app } from "../app.js";
import connectDB from "./db/connectDB.js";
import dotenv from "dotenv";
import https from "httpolyglot";
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
    NODE_ENV: process.env.NODE_ENV
});

// SSL Path inside Auth Service
const sslDir = path.join(__dirname,'server', 'ssl');
const keyPath = path.join(sslDir, 'key.pem');
const certPath = path.join(sslDir, 'cert.pem');

// Apply security middleware
app.use(helmetConfig);
app.use(limiter);
app.use(cors(corsOptions));
app.use(compressionMiddleware);

// Debug function to analyze certificate files
function debugCertificateFiles() {
    const sslDir = path.join(__dirname, 'server', 'ssl');
    console.log('SSL Directory:', sslDir);
    
    // Read files with explicit encoding
    const keyContent = fs.readFileSync(keyPath, 'utf8');
    const certContent = fs.readFileSync(certPath, 'utf8');
    
    return { key: keyContent, cert: certContent };
}

const generateCertificatePair = async () => {
    try {
        // Generate a self-signed certificate
        const cert = crypto.createCertificate({
            serialNumber: '1',
            subject: {
                C: 'US',
                ST: 'State',
                L: 'City',
                O: 'Organization',
                OU: 'Organizational Unit',
                CN: 'localhost'
            },
            issuer: {
                C: 'US',
                ST: 'State',
                L: 'City',
                O: 'Organization',
                OU: 'Organizational Unit',
                CN: 'localhost'
            },
            notBefore: new Date(),
            notAfter: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
            publicKey: crypto.generateKeyPairSync('rsa', {
                modulusLength: 2048,
                publicKeyEncoding: {
                    type: 'spki',
                    format: 'pem'
                },
                privateKeyEncoding: {
                    type: 'pkcs8',
                    format: 'pem'
                }
            }).publicKey
        });

        const { privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        });

        // Create SSL directory if it doesn't exist
        const sslDir = path.join(__dirname, 'server', 'ssl');
        if (!fs.existsSync(sslDir)) {
            fs.mkdirSync(sslDir, { recursive: true });
        }

        // Write certificates securely
        fs.writeFileSync(path.join(sslDir, 'key.pem'), privateKey);
        fs.writeFileSync(path.join(sslDir, 'cert.pem'), cert.toString());

        return { privateKey, cert: cert.toString() };
    } catch (error) {
        throw new Error(`Failed to generate certificates: ${error.message}`);
    }
}

// Add health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Start server with HTTPS
const startServer = async () => {
    try {
        // Initialize Redis
        await initializeRedis();

        // Connect to MongoDB
        await connectDB();

        // Generate certificates if they don't exist
        if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
            await generateCertificatePair();
        }

        const options = {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath)
        };

        const httpsServer = https.createServer(options, app);
        
        const port = process.env.PORT || 8000;
        
        // Try to start the server
        try {
            await httpsServer.listen(port);
            console.log(`Server running on port ${port}`);
        } catch (error) {
            if (error.code === 'EADDRINUSE') {
                console.error(`Port ${port} is already in use. Trying port ${port + 1}`);
                await httpsServer.listen(port + 1);
                console.log(`Server running on port ${port + 1}`);
            } else {
                throw error;
            }
        }

        // Error handling
        httpsServer.on('error', (error) => {
            console.error('Server error:', error);
            if (error.code !== 'EADDRINUSE') {
                throw error;
            }
        });
    } catch(error) {
        console.error('Server startup failed:', error);
        process.exit(1);
    }
}

// Start the server
startServer();