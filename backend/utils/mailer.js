import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config(
    {
         path:"./.env"
    }
);

export const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
    }
});
transporter.verify((error) => {
    if (error) {
        console.log('Server is not ready to take our messages:', error);
    } else {
        console.log('Server is ready to take our messages');
    }
});