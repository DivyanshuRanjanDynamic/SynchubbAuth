import express from 'express';
import axios from 'axios';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        // Check MongoDB connection
        const mongoStatus = 'healthy'; // Add actual MongoDB check

        // Check Auth Service connection
        let authStatus = 'unhealthy';
        try {
            const response = await axios.get(`${process.env.AUTH_SERVICE_URL}/api/v1/auth/health`);
            authStatus = response.data.status === 'healthy' ? 'healthy' : 'unhealthy';
        } catch (error) {
            console.error('Auth service health check failed:', error.message);
        }

        // Check Mediasoup workers
        const mediasoupStatus = 'healthy'; // Add actual Mediasoup worker check

        const status = mongoStatus === 'healthy' && 
                     authStatus === 'healthy' && 
                     mediasoupStatus === 'healthy' ? 'healthy' : 'degraded';

        res.json({
            status,
            services: {
                mongodb: mongoStatus,
                authService: authStatus,
                mediasoup: mediasoupStatus
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

export default router; 