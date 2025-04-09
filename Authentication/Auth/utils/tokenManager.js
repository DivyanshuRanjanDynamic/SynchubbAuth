import jwt from 'jsonwebtoken';
import { TokenBlacklist } from '../model/tokenBlacklist.model.js';

export class TokenManager {
    static async generateTokens(user) {
        const accessToken = jwt.sign(
            {
                _id: user._id,
                email: user.email,
                username: user.username,
                role: user.role,
                version: user.tokenVersion || 0
            },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
        );

        const refreshToken = jwt.sign(
            {
                _id: user._id,
                version: user.tokenVersion || 0
            },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
        );

        return { accessToken, refreshToken };
    }

    static async verifyToken(token, secret) {
        try {
            return jwt.verify(token, secret);
        } catch (error) {
            throw error;
        }
    }

    static async blacklistToken(token) {
        const decoded = jwt.decode(token);
        if (!decoded) return;

        const blacklistEntry = new TokenBlacklist({
            token,
            expiresAt: new Date(decoded.exp * 1000)
        });

        await blacklistEntry.save();
    }

    static async isTokenBlacklisted(token) {
        const blacklisted = await TokenBlacklist.findOne({ token });
        return !!blacklisted;
    }

    static async rotateTokens(user) {
        // Increment token version
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        await user.save();

        // Generate new tokens
        return this.generateTokens(user);
    }
} 