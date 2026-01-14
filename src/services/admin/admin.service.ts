import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { query } from '@/config/database';
import { logger } from '@/utils/logger';
import { NotFoundError, ValidationError, ForbiddenError } from '@/utils/errors';
import { AdminUser, AdminRole } from '@/types/admin';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
const ALGORITHM = 'aes-256-cbc';

export class AdminService {
  /**
   * Check if user is admin
   */
  async isAdmin(userId: string): Promise<boolean> {
    const result = await query(
      `SELECT id FROM admin_users WHERE user_id = $1`,
      [userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Get admin user
   */
  async getAdminUser(userId: string): Promise<AdminUser | null> {
    const result = await query(
      `SELECT * FROM admin_users WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToAdminUser(result.rows[0]);
  }

  /**
   * Create admin user
   */
  async createAdminUser(
    userId: string,
    role: AdminRole,
    createdBy: string
  ): Promise<AdminUser> {
    // Check if already admin
    const existing = await this.getAdminUser(userId);
    if (existing) {
      throw new ValidationError('User is already an admin');
    }

    // Get default permissions for role
    const permissions = this.getDefaultPermissions(role);

    await query(
      `INSERT INTO admin_users (user_id, role, permissions)
       VALUES ($1, $2, $3)`,
      [userId, role, permissions]
    );

    // Log admin action
    await this.logAdminAction(createdBy, 'admin_created', 'admin_user', userId, {
      role,
      permissions,
    });

    logger.info('Admin user created', { userId, role, createdBy });

    return await this.getAdminUser(userId) as AdminUser;
  }

  /**
   * Check if user has permission
   */
  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const admin = await this.getAdminUser(userId);
    if (!admin) {
      return false;
    }

    return admin.permissions.includes(permission) || admin.role === 'super_admin';
  }

  /**
   * Require permission (throws if not authorized)
   */
  async requirePermission(userId: string, permission: string): Promise<void> {
    const hasPerm = await this.hasPermission(userId, permission);
    if (!hasPerm) {
      throw new ForbiddenError(`Permission required: ${permission}`);
    }
  }

  /**
   * Get default permissions for role
   */
  private getDefaultPermissions(role: AdminRole): string[] {
    switch (role) {
      case 'super_admin':
        return ['*']; // All permissions
      case 'admin':
        return [
          'providers:read',
          'providers:write',
          'webhooks:read',
          'webhooks:retry',
          'bookings:read',
          'bookings:override',
          'system:metrics',
        ];
      case 'support':
        return [
          'bookings:read',
          'bookings:resend_voucher',
          'webhooks:read',
        ];
      default:
        return [];
    }
  }

  /**
   * Log admin action
   */
  async logAdminAction(
    adminId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await query(
      `INSERT INTO admin_audit_log (
        admin_id, action, resource_type, resource_id, details
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        adminId,
        action,
        resourceType,
        resourceId,
        details ? JSON.stringify(details) : null,
      ]
    );
  }

  /**
   * Get admin audit log
   */
  async getAuditLog(
    adminId?: string,
    limit: number = 100
  ): Promise<Array<{
    id: string;
    admin_id: string;
    action: string;
    resource_type: string;
    resource_id: string;
    details?: Record<string, unknown>;
    created_at: Date;
  }>> {
    let queryText = `SELECT * FROM admin_audit_log`;
    const params: unknown[] = [];

    if (adminId) {
      queryText += ` WHERE admin_id = $1`;
      params.push(adminId);
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(queryText, params);

    return result.rows.map((row) => ({
      id: row.id,
      admin_id: row.admin_id,
      action: row.action,
      resource_type: row.resource_type,
      resource_id: row.resource_id,
      details: row.details
        ? typeof row.details === 'string'
          ? JSON.parse(row.details)
          : row.details
        : undefined,
      created_at: row.created_at,
    }));
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.substring(0, 32)), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.substring(0, 32)), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private mapRowToAdminUser(row: any): AdminUser {
    return {
      id: row.id,
      user_id: row.user_id,
      role: row.role,
      permissions: row.permissions || [],
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const adminService = new AdminService();
