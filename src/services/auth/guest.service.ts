import { v4 as uuidv4 } from 'uuid';
import { query } from '@/config/database';
import { logger } from '@/utils/logger';
import { NotFoundError } from '@/utils/errors';
import { GuestSession } from '@/types/user';

const GUEST_SESSION_EXPIRES_DAYS = 30; // Guest sessions expire after 30 days

export class GuestService {
  /**
   * Create a new guest session
   */
  async createSession(): Promise<GuestSession> {
    const sessionId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + GUEST_SESSION_EXPIRES_DAYS);

    await query(
      `INSERT INTO guest_sessions (session_id, expires_at)
       VALUES ($1, $2)`,
      [sessionId, expiresAt]
    );

    logger.info('Guest session created', { sessionId });

    return {
      session_id: sessionId,
      created_at: new Date(),
      expires_at: expiresAt,
    };
  }

  /**
   * Get guest session
   */
  async getSession(sessionId: string): Promise<GuestSession> {
    const result = await query(
      `SELECT * FROM guest_sessions
       WHERE session_id = $1 AND expires_at > NOW()`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Guest session', sessionId);
    }

    return {
      session_id: result.rows[0].session_id,
      created_at: result.rows[0].created_at,
      expires_at: result.rows[0].expires_at,
    };
  }

  /**
   * Validate guest session
   */
  async validateSession(sessionId: string): Promise<boolean> {
    try {
      await this.getSession(sessionId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Move trips from guest session to user account
   */
  async moveTripsToAccount(
    guestSessionId: string,
    userId: string,
    tripIds?: string[]
  ): Promise<number> {
    // Validate guest session
    await this.getSession(guestSessionId);

    let queryText: string;
    let params: string[];

    if (tripIds && tripIds.length > 0) {
      // Move specific trips
      queryText = `
        UPDATE trips
        SET user_id = $1, guest_session_id = NULL, updated_at = NOW()
        WHERE guest_session_id = $2 AND id = ANY($3::uuid[])
        RETURNING id
      `;
      params = [userId, guestSessionId, tripIds];
    } else {
      // Move all trips from guest session
      queryText = `
        UPDATE trips
        SET user_id = $1, guest_session_id = NULL, updated_at = NOW()
        WHERE guest_session_id = $2
        RETURNING id
      `;
      params = [userId, guestSessionId];
    }

    const result = await query(queryText, params);
    const movedCount = result.rows.length;

    logger.info('Trips moved to account', {
      guestSessionId,
      userId,
      tripCount: movedCount,
    });

    return movedCount;
  }

  /**
   * Clean up expired guest sessions (run as cron job)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await query(
      `DELETE FROM guest_sessions WHERE expires_at < NOW()`
    );
    return result.rowCount || 0;
  }
}

export const guestService = new GuestService();

