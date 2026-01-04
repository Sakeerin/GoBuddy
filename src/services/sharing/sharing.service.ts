import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { query } from '@/config/database';
import { logger } from '@/utils/logger';
import { NotFoundError, ValidationError, ForbiddenError } from '@/utils/errors';
import {
  TripShare,
  ShareRole,
  CreateShareRequest,
  ShareAccess,
} from '@/types/sharing';

export class SharingService {
  /**
   * Create a share link for a trip
   */
  async createShare(
    tripId: string,
    request: CreateShareRequest,
    createdBy: string
  ): Promise<TripShare> {
    // Generate secure share token
    const shareToken = this.generateShareToken();

    const expiresAt = request.expires_at ? new Date(request.expires_at) : null;

    await query(
      `INSERT INTO trip_shares (
        trip_id, share_token, role, created_by, expires_at
      ) VALUES ($1, $2, $3, $4, $5)`,
      [tripId, shareToken, request.role, createdBy, expiresAt]
    );

    // Log share creation
    await this.logShareAction(tripId, 'share_created', createdBy, {
      role: request.role,
      expires_at: expiresAt,
    });

    logger.info('Trip share created', { tripId, shareToken, role: request.role });

    return await this.getShareByToken(shareToken);
  }

  /**
   * Get share by token
   */
  async getShareByToken(shareToken: string): Promise<TripShare> {
    const result = await query(
      `SELECT * FROM trip_shares WHERE share_token = $1`,
      [shareToken]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Share', shareToken);
    }

    const share = this.mapRowToShare(result.rows[0]);

    // Check expiration
    if (share.expires_at && share.expires_at < new Date()) {
      throw new ValidationError('Share link has expired');
    }

    return share;
  }

  /**
   * Get shares for a trip
   */
  async getSharesByTripId(tripId: string): Promise<TripShare[]> {
    const result = await query(
      `SELECT * FROM trip_shares WHERE trip_id = $1 ORDER BY created_at DESC`,
      [tripId]
    );

    return result.rows.map((row) => this.mapRowToShare(row));
  }

  /**
   * Revoke a share
   */
  async revokeShare(
    shareToken: string,
    revokedBy: string
  ): Promise<void> {
    const share = await this.getShareByToken(shareToken);

    await query(
      `DELETE FROM trip_shares WHERE share_token = $1`,
      [shareToken]
    );

    // Log revocation
    await this.logShareAction(share.trip_id, 'share_revoked', revokedBy, {
      share_token: shareToken,
    });

    logger.info('Trip share revoked', { tripId: share.trip_id, shareToken });
  }

  /**
   * Check access permissions
   */
  async checkAccess(
    tripId: string,
    userId?: string,
    shareToken?: string
  ): Promise<ShareAccess> {
    // Check if user is owner
    if (userId) {
      const tripResult = await query(
        `SELECT user_id FROM trips WHERE id = $1`,
        [tripId]
      );

      if (tripResult.rows.length > 0 && tripResult.rows[0].user_id === userId) {
        return {
          trip_id: tripId,
          role: 'owner',
          can_view: true,
          can_edit: true,
          can_delete: true,
          can_share: true,
        };
      }
    }

    // Check share token
    if (shareToken) {
      try {
        const share = await this.getShareByToken(shareToken);
        if (share.trip_id === tripId) {
          return this.getAccessForRole(share.role);
        }
      } catch {
        // Invalid token
      }
    }

    throw new ForbiddenError('Access denied');
  }

  /**
   * Get access permissions for a role
   */
  private getAccessForRole(role: ShareRole): ShareAccess {
    switch (role) {
      case 'owner':
        return {
          trip_id: '',
          role: 'owner',
          can_view: true,
          can_edit: true,
          can_delete: true,
          can_share: true,
        };
      case 'editor':
        return {
          trip_id: '',
          role: 'editor',
          can_view: true,
          can_edit: true,
          can_delete: false,
          can_share: false,
        };
      case 'viewer':
        return {
          trip_id: '',
          role: 'viewer',
          can_view: true,
          can_edit: false,
          can_delete: false,
          can_share: false,
        };
    }
  }

  /**
   * Generate secure share token
   */
  private generateShareToken(): string {
    // Generate a URL-safe token
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Log share action for audit
   */
  private async logShareAction(
    tripId: string,
    action: string,
    userId: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await query(
      `INSERT INTO share_audit_log (
        trip_id, action, user_id, details
      ) VALUES ($1, $2, $3, $4)`,
      [tripId, action, userId, details ? JSON.stringify(details) : null]
    );
  }

  /**
   * Get audit log for a trip
   */
  async getAuditLog(tripId: string): Promise<Array<{
    id: string;
    action: string;
    user_id: string;
    details?: Record<string, unknown>;
    created_at: Date;
  }>> {
    const result = await query(
      `SELECT * FROM share_audit_log
       WHERE trip_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [tripId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      action: row.action,
      user_id: row.user_id,
      details: row.details ? (typeof row.details === 'string' ? JSON.parse(row.details) : row.details) : undefined,
      created_at: row.created_at,
    }));
  }

  private mapRowToShare(row: any): TripShare {
    return {
      id: row.id,
      trip_id: row.trip_id,
      share_token: row.share_token,
      role: row.role,
      created_by: row.created_by,
      expires_at: row.expires_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const sharingService = new SharingService();

