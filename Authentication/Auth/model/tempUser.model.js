import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const tempUserSchema = new mongoose.Schema({
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
        required: [true, "Password is required"],
        minlength: [8, "Password must be at least 8 characters long"]
    },
    plainPassword: {
        type: String,
        required: [true, "Plain password is required"]
    },
    verificationCode: {
        type: String,
        required: true
    },
    verificationCodeExpires: {
        type: Date,
        required: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationAttempts: {
        type: Number,
        default: 0
    },
    lastVerificationAttempt: {
        type: Date
    }
}, {
    timestamps: true
});

// Hash password before saving
tempUserSchema.pre("save", async function(next) {
    if (!this.isModified("password")) return next();
    
    try {
        // Store the plain password before hashing
        this.plainPassword = this.password;
        
        // Hash the password
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        
        next();
    } catch (error) {
        next(error);
    }
});

// Method to check password
tempUserSchema.methods.comparePassword = async function(password) {
    try {
        return await bcrypt.compare(password, this.password);
    } catch (error) {
        throw error;
    }
};

// Method to increment verification attempts
tempUserSchema.methods.incrementVerificationAttempts = async function() {
    this.verificationAttempts += 1;
    this.lastVerificationAttempt = new Date();
    await this.save();
};

// Method to check if verification attempts are exceeded
tempUserSchema.methods.hasExceededVerificationAttempts = function() {
    return this.verificationAttempts >= 3;
};

// Method to get plain password (for transfer to permanent user)
tempUserSchema.methods.getPlainPassword = function() {
    return this.plainPassword;
};

export const TempUser = mongoose.model("TempUser", tempUserSchema); 