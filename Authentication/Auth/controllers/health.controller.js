import { asyncHandler } from '../utils/asynchandler.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const healthCheck = asyncHandler(async (req, res) => {
    try {
        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    {
                        status: "healthy",
                        timestamp: new Date().toISOString(),
                        uptime: process.uptime(),
                        memory: process.memoryUsage(),
                        env: process.env.NODE_ENV
                    },
                    "Service is healthy"
                )
            );
    } catch (error) {
        // Even if there's an error, we want to return a 200 status
        // to indicate the service is running
        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    {
                        status: "degraded",
                        error: error.message,
                        timestamp: new Date().toISOString()
                    },
                    "Service is running but with issues"
                )
            );
    }
}); 