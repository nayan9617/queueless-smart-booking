import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

// Create transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

export const sendEmail = async (to: string, subject: string, html: string) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to,
            subject,
            html
        };
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
        return info;
    } catch (error) {
        console.error('Error sending email:', error);
        // Don't throw, just log. We don't want to fail bookings if email fails.
        return null;
    }
};

export const sendBookingConfirmation = async (booking: any, salonName: string) => {
    const servicesList = booking.services.map((s: any) =>
        `<li>${s.name} (${s.duration} min) - $${s.price} ${s.guestName ? `for ${s.guestName}` : ''}</li>`
    ).join('');

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Booking Confirmed!</h2>
            <p>Hi,</p>
            <p>Your appointment at <strong>${salonName}</strong> has been confirmed.</p>
            
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Order Summary</h3>
                <ul style="padding-left: 20px;">
                    ${servicesList}
                </ul>
                <p><strong>Total Amount:</strong> $${booking.totalAmount}</p>
                <p><strong>Estimated Wait Time:</strong> ${booking.estimatedWaitTime} mins</p>
            </div>
            
            <p>We will notify you if there are any changes to your estimated start time.</p>
            <p>Thank you for choosing QueueLess!</p>
        </div>
    `;

    // Send to contact email if present, otherwise rely on user email (controller logic)
    const recipient = booking.contactInfo?.email;
    console.log(`Sending confirmation to: ${recipient}`);
    if (recipient) {
        await sendEmail(recipient, `Booking Confirmation - ${salonName}`, html);
    } else {
        console.warn('Booking has no contact email!');
    }
};

export const sendBookingUpdate = async (booking: any, salonName: string, newWaitTime: number) => {
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #eab308;">Update on your Booking</h2>
            <p>Hi,</p>
            <p>Your estimated wait time at <strong>${salonName}</strong> has been updated.</p>
            
            <div style="background-color: #fefce8; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #fde047;">
                <p><strong>New Estimated Wait Time:</strong> ${newWaitTime} mins</p>
            </div>
            
            <p>We apologize for any inconvenience.</p>
        </div>
    `;

    const recipient = booking.contactInfo?.email;
    console.log(`Sending update to user: ${recipient}`);
    if (recipient) {
        await sendEmail(recipient, `Update: Wait Time Changed - ${salonName}`, html);
    }
};

export const sendNewBookingNotification = async (ownerEmail: string, booking: any) => {
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">New Booking Received!</h2>
            <p>Hi,</p>
            <p>You have a new customer in the queue.</p>
            
            <div style="background-color: #ecfdf5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Customer:</strong> ${booking.services?.[0]?.guestName || booking.userId?.name || 'Guest'}</p>
                <p><strong>Contact:</strong> ${booking.contactInfo?.phone || 'N/A'} | ${booking.contactInfo?.email || 'N/A'}</p>
                <p><strong>Services:</strong> ${booking.services.map((s: any) => s.name).join(', ')}</p>
                <p><strong>Total Amount:</strong> $${booking.totalAmount}</p>
            </div>
            
            <p>Check your dashboard for details.</p>
        </div>
    `;
    console.log(`Sending new booking notification to owner: ${ownerEmail}`);
    if (ownerEmail) {
        await sendEmail(ownerEmail, 'New QueueLess Booking', html);
    }
};

export const sendWelcomeEmail = async (email: string, name: string) => {
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4f46e5;">Welcome to QueueLess!</h2>
            <p>Hi ${name},</p>
            <p>Thank you for joining QueueLess. We are excited to help you save time and book smart.</p>
            <p>You can now:</p>
            <ul>
                <li>Discover nearby salons</li>
                <li>Book appointments without waiting in line</li>
                <li>Track your queue status in real-time</li>
            </ul>
            <p>Get started by exploring salons near you!</p>
            <br/>
            <div style="text-align: center;">
                <a href="${clientUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Go to Dashboard</a>
            </div>
        </div>
    `;
    console.log(`Sending welcome email to: ${email}`);
    await sendEmail(email, 'Welcome to QueueLess', html);
};

export const sendBookingCompletion = async (booking: any, salonName: string) => {
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #6366f1;">Service Completed!</h2>
            <p>Hi,</p>
            <p>We hope you enjoyed your service at <strong>${salonName}</strong>.</p>
            
            <p>Thank you for using QueueLess. We would love to hear your feedback!</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${clientUrl}/dashboard" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Rate Your Experience</a>
            </div>
            
            <p>See you next time!</p>
        </div>
    `;

    const recipient = booking.contactInfo?.email;
    console.log(`Sending completion email to: ${recipient}`);
    if (recipient) {
        await sendEmail(recipient, `How was your visit at ${salonName}?`, html);
    }
};
