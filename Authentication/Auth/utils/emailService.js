import nodemailer from 'nodemailer';

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    }

    async sendEmail(to, subject, text, html) {
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to,
                subject,
                text,
                html
            };

            const info = await this.transporter.sendMail(mailOptions);
            return info;
        } catch (error) {
            console.error('Error sending email:', error);
            throw error;
        }
    }

    async sendVerificationEmail(user, token) {
        const verificationUrl = `${process.env.SERVER_URL}/api/auth/verify-email/${token}`;
        const subject = 'Verify Your Email';
        const text = `Please click on the following link to verify your email: ${verificationUrl}`;
        const html = `
            <h1>Email Verification</h1>
            <p>Please click on the following link to verify your email:</p>
            <a href="${verificationUrl}">Verify Email</a>
        `;

        return this.sendEmail(user.email, subject, text, html);
    }

    async sendPasswordResetEmail(user, token) {
        const resetUrl = `${process.env.SERVER_URL}/api/auth/reset-password/${token}`;
        const subject = 'Password Reset Request';
        const text = `Please click on the following link to reset your password: ${resetUrl}`;
        const html = `
            <h1>Password Reset</h1>
            <p>Please click on the following link to reset your password:</p>
            <a href="${resetUrl}">Reset Password</a>
        `;

        return this.sendEmail(user.email, subject, text, html);
    }
}

export const emailService = new EmailService(); 
