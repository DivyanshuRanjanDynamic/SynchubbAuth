import mongoose from "mongoose"
import { DBNAME } from "../../constant.js";
import { cacheService } from '../services/cache.js';


export const connectDB = async () =>{
    try {
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 5,
            maxIdleTimeMS: 30000,
            waitQueueTimeoutMS: 10000,
            retryWrites: true,
            retryReads: true
        };

        console.log(`MongoDB URI: ${process.env.MONGO_URI}/${DBNAME}`);
        const connection = await mongoose.connect(process.env.MONGO_URI, options);
        
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
        console.error('Failed to connect to MongoDB', err);
        process.exit(1);//1 is for failure and 0 is for sucess
    }
}

export default connectDB;