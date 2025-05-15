import nodemailer from 'nodemailer';

class EmailService {
    constructor() {
        // Log environment variables for debugging
        console.log('Email Configuration:');
        console.log('EMAIL_USERNAME:', process.env.EMAIL_USERNAME ? 'Set' : 'Not Set');
        console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? 'Set' : 'Not Set');
        console.log('CLIENT_URL:', process.env.CLIENT_URL || 'Not Set');

        if (!process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
            throw new Error('Email credentials are not configured in environment variables');
        }

        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USERNAME,
                pass: process.env.EMAIL_PASSWORD
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        // Verify transporter configuration
        this.transporter.verify((error, success) => {
            if (error) {
                console.error('Email transporter verification failed:', error);
            } else {
                console.log('Email transporter is ready to send emails');
            }
        });
    }

    async sendEmail(options) {
        try {
            if (!options.to) {
                throw new Error('No recipients defined');
            }

            console.log('Sending email to:', options.to);
            console.log('From:', process.env.EMAIL_USERNAME);

            const mailOptions = {
                from: process.env.EMAIL_USERNAME,
                to: options.to,
                subject: options.subject,
                html: options.html
            };

            console.log('Mail options:', {
                ...mailOptions,
                from: mailOptions.from,
                to: mailOptions.to,
                subject: mailOptions.subject
            });

            const info = await this.transporter.sendMail(mailOptions);
            console.log('Email sent successfully:', info.messageId);
            return info;
        } catch (error) {
            console.error('Error sending email:', error);
            if (error.code === 'EAUTH') {
                throw new Error('Email authentication failed. Please check your email credentials in .env file');
            }
            throw error;
        }
    }

    async sendVerificationEmail(user, token) {
        const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${token}`;
        const message = `
            <h1>Email Verification</h1>
            <p>Please verify your email by clicking the link below:</p>
            <a href="${verificationUrl}" target="_blank">Verify Email</a>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't request this, please ignore this email.</p>
        `;

        await this.sendEmail({
            to: user.email,
            subject: 'Email Verification',
            html: message
        });
    }

    async sendPasswordResetEmail(user, token) {
        const resetUrl = `${process.env.CLIENT_URL}/reset-password/${token}`;
        const message = `
            <h1>Password Reset Request</h1>
            <p>You requested a password reset. Click the link below to reset your password:</p>
            <a href="${resetUrl}" target="_blank">Reset Password</a>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't request this, please ignore this email.</p>
        `;

        await this.sendEmail({
            to: user.email,
            subject: 'Password Reset Request',
            html: message
        });
    }
}

export const emailService = new EmailService(); 