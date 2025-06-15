import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, "Username is required"],
        unique: true,
        trim: true,
        index: true
    },
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    password: {
        type: String,
        required: [function() {
            return !this.googleId && !this.githubId; // Password required only if not OAuth
        }, "Password is required"],
        minlength: [8, "Password must be at least 8 characters long"]
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    githubId: {
        type: String,
        unique: true,
        sparse: true
    },
    profilePic: {
        type: String,
        default: ""
    },
    isVerified: {
        type: Boolean,
        default: true // Since we only create users after verification
    },
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user"
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    refreshToken: {
        type: String
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
    // Add account locking fields
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: {
        type: Date
    }
}, {
    timestamps: true
});

// Add static method for OAuth user creation/finding
userSchema.statics.findOrCreateOAuthUser = async function(profile, provider) {
    try {
        let user;
        const providerIdField = provider === 'google' ? 'googleId' : 'githubId';
        let emailFromProfile = profile.emails?.[0]?.value || "";

        // Normalize email from profile consistently, similar to how it's handled in registration/login
        let normalizedEmail = emailFromProfile;
        if (emailFromProfile) {
            normalizedEmail = emailFromProfile.toLowerCase().replace(/\.(?=.*@gmail\.com)/g, '');
        }

        console.log(`[OAuth - ${provider}] Attempting to find user:`, {
            profileId: profile.id,
            providerIdField,
            emailFromProfile,
            normalizedEmail
        });

        // 1. Try to find existing user by provider ID
        user = await this.findOne({ [providerIdField]: profile.id });
        
        if (user) {
            console.log(`[OAuth - ${provider}] Found existing user by ${provider} ID:`, user.email);
            return user;
        }

        // 2. If not found by provider ID, try to find by email
        if (emailFromProfile) {
            console.log(`[OAuth - ${provider}] Attempting to find user by email:`, {
                normalizedEmail: normalizedEmail,
                plainLowercaseEmail: emailFromProfile.toLowerCase()
            });
            user = await this.findOne({
                $or: [
                    { email: normalizedEmail },
                    { email: emailFromProfile.toLowerCase() } // Use plain lowercase as fallback
                ]
            });
            if (user) {
                console.log(`[OAuth - ${provider}] Found existing user by email, linking ${provider} ID:`, user.email);
                // Link the OAuth ID to the existing user
                user[providerIdField] = profile.id;
                // Ensure other fields are updated if necessary (e.g., profile pic from OAuth)
                if (!user.profilePic && profile.photos?.[0]?.value) {
                    user.profilePic = profile.photos[0].value;
                }
                await user.save();
                return user;
            }
        }

        // 3. If still not found, create a new user
        console.log(`[OAuth - ${provider}] Creating new user with email:`, normalizedEmail || profile.username);
        const userData = {
            [providerIdField]: profile.id,
            email: normalizedEmail,
            username: provider === 'google' ? profile.displayName : profile.username,
            profilePic: profile.photos?.[0]?.value || "",
            isVerified: true // OAuth users are automatically verified
        };
        
        user = new this(userData);
        await user.save();
        
        console.log(`[OAuth - ${provider}] New user created:`, user.email);
        return user;
    } catch (error) {
        console.error(`[OAuth - ${provider}] Error in findOrCreateOAuthUser:`, error);
        throw error;
    }
};

// Password hashing middleware
userSchema.pre("save", async function(next) {
    if (!this.isModified("password")) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
userSchema.methods.comparePassword = async function(password) {
    try {
        return await bcrypt.compare(password, this.password);
    } catch (error) {
        throw error;
    }
};

// Method to generate access token
userSchema.methods.generateAccessToken = function() {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            role: this.role
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    );
};

// Method to generate refresh token
userSchema.methods.generateRefreshToken = function() {
    return jwt.sign(
        {
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    );
};

// Method to generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
    const resetToken = crypto.randomBytes(32).toString('hex');

    this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    return resetToken;
};

// Method to generate email verification token
userSchema.methods.createEmailVerificationToken = function() {
    const verificationToken = crypto.randomBytes(32).toString("hex");
    
    this.emailVerificationToken = crypto
        .createHash("sha256")
        .update(verificationToken)
        .digest("hex");
    
    this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    
    return verificationToken;
};

// Account locking methods
userSchema.methods.isLocked = function() {
    return this.lockUntil && this.lockUntil > Date.now();
};

const LOCK_TIME = 15 * 60 * 1000; // 15 minutes
const MAX_LOGIN_ATTEMPTS = 5;

userSchema.methods.incrementLoginAttempts = async function() {
    this.loginAttempts += 1;
    if (this.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        this.lockUntil = new Date(Date.now() + LOCK_TIME);
    }
    await this.save();
};

userSchema.methods.resetLoginAttempts = async function() {
    this.loginAttempts = 0;
    this.lockUntil = undefined;
    await this.save();
};

export const User = mongoose.model("User", userSchema);   

