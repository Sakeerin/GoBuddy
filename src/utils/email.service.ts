import nodemailer from 'nodemailer';
import { logger } from './logger';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@gobuddy.com';

let transporter: nodemailer.Transporter | null = null;

/**
 * Initialize email transporter
 */
function getTransporter(): nodemailer.Transporter | null {
  if (!SMTP_USER || !SMTP_PASSWORD) {
    logger.warn('SMTP credentials not configured, email sending disabled');
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
      },
    });
  }

  return transporter;
}

/**
 * Send email
 */
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<void> {
  const mailTransporter = getTransporter();

  if (!mailTransporter) {
    logger.warn('Email transporter not available, skipping email send', {
      to,
      subject,
    });
    return;
  }

  try {
    const info = await mailTransporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      text,
      html: html || text,
    });

    logger.info('Email sent successfully', {
      to,
      subject,
      messageId: info.messageId,
    });
  } catch (error) {
    logger.error('Failed to send email', {
      to,
      subject,
      error,
    });
    throw error;
  }
}

/**
 * Send OTP email
 */
export async function sendOTPEmail(email: string, otpCode: string): Promise<void> {
  const subject = 'Your GoBuddy OTP Code';
  const text = `Your GoBuddy verification code is: ${otpCode}\n\nThis code will expire in 5 minutes.\n\nIf you didn't request this code, please ignore this email.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">GoBuddy Verification Code</h2>
      <p>Your verification code is:</p>
      <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
        ${otpCode}
      </div>
      <p>This code will expire in 5 minutes.</p>
      <p style="color: #666; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
    </div>
  `;

  await sendEmail(email, subject, text, html);
}

/**
 * Send booking confirmation email
 */
export async function sendBookingConfirmationEmail(
  email: string,
  bookingDetails: {
    confirmationNumber: string;
    itemName: string;
    date: string;
    time?: string;
    voucherUrl?: string;
  }
): Promise<void> {
  const subject = `Booking Confirmed - ${bookingDetails.confirmationNumber}`;
  const text = `
Your booking has been confirmed!

Confirmation Number: ${bookingDetails.confirmationNumber}
Item: ${bookingDetails.itemName}
Date: ${bookingDetails.date}
${bookingDetails.time ? `Time: ${bookingDetails.time}` : ''}
${bookingDetails.voucherUrl ? `Voucher: ${bookingDetails.voucherUrl}` : ''}

Thank you for using GoBuddy!
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #28a745;">Booking Confirmed!</h2>
      <p>Your booking has been confirmed.</p>
      <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0;">
        <p><strong>Confirmation Number:</strong> ${bookingDetails.confirmationNumber}</p>
        <p><strong>Item:</strong> ${bookingDetails.itemName}</p>
        <p><strong>Date:</strong> ${bookingDetails.date}</p>
        ${bookingDetails.time ? `<p><strong>Time:</strong> ${bookingDetails.time}</p>` : ''}
        ${bookingDetails.voucherUrl ? `<p><strong>Voucher:</strong> <a href="${bookingDetails.voucherUrl}">View Voucher</a></p>` : ''}
      </div>
      <p>Thank you for using GoBuddy!</p>
    </div>
  `;

  await sendEmail(email, subject, text, html);
}
