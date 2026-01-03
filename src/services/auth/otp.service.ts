import { query } from '@/config/database';
import { getRedisClient } from '@/config/redis';
import { logger } from '@/utils/logger';
import { ConflictError, ValidationError } from '@/utils/errors';

const OTP_LENGTH = parseInt(process.env.OTP_LENGTH || '6', 10);
const OTP_EXPIRES_IN = parseInt(process.env.OTP_EXPIRES_IN || '300', 10); // 5 minutes

export class OTPService {
  /**
   * Generate a random OTP code
   */
  private generateOTP(): string {
    return Math.floor(
      100000 + Math.random() * 900000
    ).toString().padStart(OTP_LENGTH, '0');
  }

  /**
   * Send OTP to email
   */
  async sendOTP(email: string): Promise<void> {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format');
    }

    const code = this.generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRES_IN * 1000);

    // Store OTP in database
    await query(
      `INSERT INTO otp_codes (email, code, expires_at)
       VALUES ($1, $2, $3)`,
      [email, code, expiresAt]
    );

    // Store in Redis for faster lookup (optional, for high traffic)
    try {
      const redis = await getRedisClient();
      await redis.setEx(
        `otp:${email}`,
        OTP_EXPIRES_IN,
        code
      );
    } catch (err) {
      logger.warn('Redis OTP storage failed, using DB only', err);
    }

    // TODO: Send email via nodemailer
    // For now, log the OTP (remove in production!)
    logger.info('OTP generated', { email, code });

    // In production, send email:
    // await sendEmail(email, 'Your GoBuddy OTP', `Your OTP code is: ${code}`);
  }

  /**
   * Verify OTP code
   */
  async verifyOTP(email: string, otp: string): Promise<boolean> {
    // Check Redis first
    try {
      const redis = await getRedisClient();
      const cachedCode = await redis.get(`otp:${email}`);
      if (cachedCode === otp) {
        // Mark as used in DB
        await query(
          `UPDATE otp_codes SET used = TRUE WHERE email = $1 AND code = $2`,
          [email, otp]
        );
        await redis.del(`otp:${email}`);
        return true;
      }
    } catch (err) {
      logger.warn('Redis OTP check failed, using DB', err);
    }

    // Check database
    const result = await query(
      `SELECT id, expires_at, used
       FROM otp_codes
       WHERE email = $1 AND code = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [email, otp]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const otpRecord = result.rows[0];

    // Check if already used
    if (otpRecord.used) {
      throw new ConflictError('OTP code has already been used');
    }

    // Check if expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      throw new ValidationError('OTP code has expired');
    }

    // Mark as used
    await query(
      `UPDATE otp_codes SET used = TRUE WHERE id = $1`,
      [otpRecord.id]
    );

    return true;
  }

  /**
   * Clean up expired OTPs (run as cron job)
   */
  async cleanupExpiredOTPs(): Promise<number> {
    const result = await query(
      `DELETE FROM otp_codes WHERE expires_at < NOW() - INTERVAL '1 day'`
    );
    return result.rowCount || 0;
  }
}

export const otpService = new OTPService();

