import { body, validationResult } from 'express-validator';

// Common validation rules
const passwordValidation = body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character');

const emailValidation = body('email')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail()
    .trim();

// Login validation - only check email format and password presence
export const validateLogin = [
    emailValidation,
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];

// Registration validation
export const validateRegister = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be between 3 and 30 characters long')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores')
        .custom(value => {
            // Add custom validation for reserved usernames if needed
            const reservedUsernames = ['admin', 'root', 'system'];
            if (reservedUsernames.includes(value.toLowerCase()))
             {
                throw new Error('This username is reserved');
             }
            return true;
        }),
    emailValidation,
    passwordValidation
];

// Password reset validation
export const validatePasswordReset = [
    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Please enter a valid email address')
        .normalizeEmail()
];

// New password validation for reset
export const validateNewPassword = [
    passwordValidation,
    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Passwords do not match');
            }
            return true;
        })
];

// Profile update validation
export const validateProfileUpdate = [
    body('username')
        .optional()
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be between 3 and 30 characters long')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores'),
    body('email')
        .optional()
        .isEmail()
        .withMessage('Please enter a valid email address')
        .normalizeEmail(),
    body('bio')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Bio must not exceed 500 characters'),
    body('avatar')
        .optional()
        .isURL()
        .withMessage('Avatar must be a valid URL')
];

// Account deletion validation
export const validateAccountDeletion = [
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];

// Middleware to handle validation results
export const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            status: 'error',
            message: 'Validation failed',
            errors: errors.array().map(err => ({
                field: err.param,
                message: err.msg
            }))
        });
    }
    next();
}; 