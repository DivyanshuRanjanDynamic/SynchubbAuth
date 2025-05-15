import mongoose from "mongoose"
import { cacheService } from '../services/cache.js';

export const connectDB = async () => {
    try {
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 5,
            maxIdleTimeMS: 30000,
            waitQueueTimeoutMS: 10000,
            retryWrites: true,
            retryReads: true,
            connectTimeoutMS: 10000
        };

        if (!process.env.MONGO_URI) {
            throw new Error('MongoDB URI is not defined in environment variables');
        }

        console.log('Attempting to connect to MongoDB...');
        const connection = await mongoose.connect(process.env.MONGO_URI, options);
        console.log('MongoDB connected successfully');
        
        // Set up connection event listeners
        mongoose.connection.on('connected', () => {
            console.log('MongoDB connected successfully');
        });

        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
        });

        // Handle process termination
        process.on('SIGINT', async () => {
            try {
                await mongoose.connection.close();
                await cacheService.clear();
                console.log('MongoDB connection closed through app termination');
                process.exit(0);
            } catch (err) {
                console.error('Error during shutdown:', err);
                process.exit(1);
            }
        });

        return connection;
    } catch (err) {
        console.error('Failed to connect to MongoDB:', err.message);
        if (err.code === 'ECONNREFUSED') {
            console.error('MongoDB server is not running or not accessible');
        } else if (err.code === 'ENOTFOUND') {
            console.error('MongoDB host not found');
        } else if (err.code === 'ETIMEDOUT') {
            console.error('Connection to MongoDB timed out');
        }
        process.exit(1);
    }
}

export default connectDB;