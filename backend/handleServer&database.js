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

// Debug function to analyze certificate files
function debugCertificateFiles() {
    const sslDir = path.join(__dirname, 'server', 'ssl');
    console.log('SSL Directory:', sslDir);
    
    // Read files with explicit encoding
    const keyContent = fs.readFileSync(path.join(sslDir, 'key.pem'), 'utf8');
    const certContent = fs.readFileSync(path.join(sslDir, 'cert.pem'), 'utf8');
    
    return { key: keyContent, cert: certContent };
}

 const generateCertificatePair = async () =>
 {
    try
   {
       // Generate key pair using Node.js crypto module
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
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

           // Ensure PEM headers and footers are present
           const publicKeyPEM = publicKey.includes('-----BEGIN PUBLIC KEY-----') 
           ? publicKey 
           : `-----BEGIN PUBLIC KEY-----
${publicKey}
-----END PUBLIC KEY-----`;

       const privateKeyPEM = privateKey.includes('-----BEGIN PRIVATE KEY-----')
           ? privateKey 
           : `-----BEGIN PRIVATE KEY-----
${privateKey}
-----END PRIVATE KEY-----`;

       // Create SSL directory if it doesn't exist
        const sslDir = './server/ssl';
        if (!fs.existsSync(sslDir)) {
            fs.mkdirSync(sslDir, { recursive: true });
        }

      //  Write certificates securely
        fs.writeFileSync(`${sslDir}/key.pem`, privateKey);
        fs.writeFileSync(`${sslDir}/cert.pem`, publicKey);

        return { privateKey, publicKey };
    } 
    catch (error) {
        throw new Error(`Failed to generate certificates: ${error.message}`);
    }
}

// Start server with HTTPS
 const startServer = async () =>
{
     try 
     {
        
         // Generate certificates if they don't exist
         if (!fs.existsSync('./server/ssl/key.pem') || !fs.existsSync('./server/ssl/cert.pem')) {
            await generateCertificatePair();
        }

         // Debug certificate files
         const { key, cert } = debugCertificateFiles();
        
         const options = {
            key: Buffer.from(key, 'utf8'),
            cert: Buffer.from(cert, 'utf8')
        };

         const httpsServer = https.createServer(options, app);
          // Connect to database before starting server
          await connectDB();
        
          // Start server
          await httpsServer.listen(process.env.PORT || 8000);
             console.log(`Server running on port ${process.env.PORT}`);

            // Error handling
                 httpsServer.on('error', (error) => {
                     console.error('Server error:', error);
                     throw error;
                    });
    }
    catch(error)
    {
                 console.error('Database connection failed:', error);
                 throw error;
     };
} 
 
// Start the server
 startServer();