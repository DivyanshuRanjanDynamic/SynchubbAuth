import { app } from "../app.js";
import connectDB from "./db/connectDB.js";
import dotenv from "dotenv";
import https from "httpolyglot";
import fs from "fs";
import crypto from 'crypto';
import path from "path";
import { fileURLToPath } from 'url';

// Configure environment variables
dotenv.config({ path: "./.env" });

// Convert ES module URL to path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SSL Path inside Auth Service
const sslDir = path.join(__dirname, 'ssl');
const keyPath = path.join(sslDir, 'key.pem');
const certPath = path.join(sslDir, 'cert.pem');

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

// Start server with HTTPS
const startServer = async () => {
    try {
        // Generate certificates if they don't exist
        const sslDir = path.join(__dirname, 'server', 'ssl');
        if (!fs.existsSync(path.join(sslDir, 'key.pem')) || !fs.existsSync(path.join(sslDir, 'cert.pem'))) {
            await generateCertificatePair();
        }

        // Debug certificate files
        const { key, cert } = debugCertificateFiles();
        
        const options = {
            key: fs.readFileSync(path.join(sslDir, 'key.pem')),
            cert: fs.readFileSync(path.join(sslDir, 'cert.pem'))
        };

        const httpsServer = https.createServer(options, app);
        
        // Connect to database before starting server
        await connectDB();
        
        // Start server
        const port = process.env.PORT || 8000;
        await httpsServer.listen(port);
        console.log(`Server running on port ${port}`);

        // Error handling
        httpsServer.on('error', (error) => {
            console.error('Server error:', error);
            throw error;
        });
    } catch(error) {
        console.error('Server startup failed:', error);
        throw error;
    }
}

// Start the server
startServer();