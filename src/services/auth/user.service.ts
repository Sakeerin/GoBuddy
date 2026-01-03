import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '@/config/database';
import { logger } from '@/utils/logger';
import { NotFoundError, UnauthorizedError, ConflictError } from '@/utils/errors';
import { User, UserProfile, AuthToken } from '@/types/user';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export class UserService {
  /**
   * Create a new user
   */
  async createUser(
    email: string,
    password?: string,
    authProvider: 'email' | 'google' | 'apple' = 'email',
    name?: string,
    avatarUrl?: string
  ): Promise<User> {
    // Check if user already exists
    const existing = await query(
      `SELECT id FROM users WHERE email = $1`,
      [email]
    );

    if (existing.rows.length > 0) {
      throw new ConflictError('User with this email already exists');
    }

    let passwordHash: string | null = null;
    if (password && authProvider === 'email') {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const result = await query(
      `INSERT INTO users (email, password_hash, auth_provider, name, avatar_url, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        email,
        passwordHash,
        authProvider,
        name || null,
        avatarUrl || null,
        authProvider !== 'email', // OAuth users are pre-verified
      ]
    );

    const user = this.mapRowToUser(result.rows[0]);

    // Create default profile
    await this.createProfile(user.id);

    logger.info('User created', { userId: user.id, email });
    return user;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User> {
    const result = await query(
      `SELECT * FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('User', userId);
    }

    return this.mapRowToUser(result.rows[0]);
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const result = await query(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToUser(result.rows[0]);
  }

  /**
   * Verify password
   */
  async verifyPassword(email: string, password: string): Promise<User> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.password_hash) {
      throw new UnauthorizedError('Password authentication not available for this account');
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    return user;
  }

  /**
   * Generate JWT token
   */
  generateToken(user: User): string {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string): Promise<User> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
      return await this.getUserById(decoded.userId);
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }

  /**
   * Create or update user profile
   */
  async createProfile(userId: string, profileData?: Partial<UserProfile>): Promise<UserProfile> {
    const defaultProfile = {
      language: 'en',
      currency: 'THB',
      distance_unit: 'km' as const,
      dietary_restrictions: [],
      mobility_constraints: [],
      travel_preferences: {
        budget: 'mid' as const,
        comfort: 'comfortable' as const,
        adventure: 'medium' as const,
      },
    };

    const profile = { ...defaultProfile, ...profileData };

    const result = await query(
      `INSERT INTO user_profiles (
        user_id, language, currency, distance_unit,
        dietary_restrictions, mobility_constraints, travel_preferences
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id) DO UPDATE SET
        language = EXCLUDED.language,
        currency = EXCLUDED.currency,
        distance_unit = EXCLUDED.distance_unit,
        dietary_restrictions = EXCLUDED.dietary_restrictions,
        mobility_constraints = EXCLUDED.mobility_constraints,
        travel_preferences = EXCLUDED.travel_preferences,
        updated_at = NOW()
      RETURNING *`,
      [
        userId,
        profile.language,
        profile.currency,
        profile.distance_unit,
        profile.dietary_restrictions,
        profile.mobility_constraints,
        JSON.stringify(profile.travel_preferences),
      ]
    );

    return this.mapRowToProfile(result.rows[0]);
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string): Promise<UserProfile | null> {
    const result = await query(
      `SELECT * FROM user_profiles WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToProfile(result.rows[0]);
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    updates: Partial<UserProfile>
  ): Promise<UserProfile> {
    const existing = await this.getProfile(userId);
    if (!existing) {
      return await this.createProfile(userId, updates);
    }

    const updated = { ...existing, ...updates };

    const result = await query(
      `UPDATE user_profiles SET
        language = $1,
        currency = $2,
        distance_unit = $3,
        dietary_restrictions = $4,
        mobility_constraints = $5,
        travel_preferences = $6,
        updated_at = NOW()
      WHERE user_id = $7
      RETURNING *`,
      [
        updated.language,
        updated.currency,
        updated.distance_unit,
        updated.dietary_restrictions,
        updated.mobility_constraints,
        JSON.stringify(updated.travel_preferences),
        userId,
      ]
    );

    return this.mapRowToProfile(result.rows[0]);
  }

  /**
   * Login and return auth token
   */
  async login(email: string, password: string): Promise<AuthToken> {
    const user = await this.verifyPassword(email, password);
    const profile = await this.getProfile(user.id);

    const accessToken = this.generateToken(user);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 7 * 24 * 60 * 60, // 7 days in seconds
      user,
      profile: profile || undefined,
    };
  }

  /**
   * Register new user
   */
  async register(
    email: string,
    password: string,
    name?: string
  ): Promise<AuthToken> {
    const user = await this.createUser(email, password, 'email', name);
    const profile = await this.getProfile(user.id);

    const accessToken = this.generateToken(user);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 7 * 24 * 60 * 60,
      user,
      profile: profile || undefined,
    };
  }

  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      email_verified: row.email_verified,
      name: row.name,
      avatar_url: row.avatar_url,
      auth_provider: row.auth_provider,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapRowToProfile(row: any): UserProfile {
    return {
      user_id: row.user_id,
      language: row.language,
      currency: row.currency,
      distance_unit: row.distance_unit,
      dietary_restrictions: row.dietary_restrictions || [],
      mobility_constraints: row.mobility_constraints || [],
      travel_preferences: typeof row.travel_preferences === 'string'
        ? JSON.parse(row.travel_preferences)
        : row.travel_preferences,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const userService = new UserService();

