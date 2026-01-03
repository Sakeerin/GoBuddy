import { OAuth2Client } from 'google-auth-library';
import { userService } from './user.service';
import { logger } from '@/utils/logger';
import { UnauthorizedError } from '@/utils/errors';
import { User, AuthToken } from '@/types/user';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';

const oauth2Client = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

export class GoogleOAuthService {
  /**
   * Get Google OAuth authorization URL
   */
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
  }

  /**
   * Exchange authorization code for tokens and get user info
   */
  async handleCallback(code: string): Promise<AuthToken> {
    try {
      // Exchange code for tokens
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      // Get user info from Google
      const ticket = await oauth2Client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new UnauthorizedError('Failed to get user information from Google');
      }

      const email = payload.email;
      const name = payload.name || undefined;
      const avatarUrl = payload.picture || undefined;

      // Check if user exists
      let user = await userService.getUserByEmail(email);

      if (!user) {
        // Create new user
        user = await userService.createUser(
          email,
          undefined, // No password for OAuth
          'google',
          name,
          avatarUrl
        );
      } else if (user.auth_provider !== 'google') {
        // User exists but with different auth provider
        throw new UnauthorizedError(
          'An account with this email already exists. Please use email/password login.'
        );
      }

      // Generate JWT token
      const accessToken = userService.generateToken(user);
      const profile = await userService.getProfile(user.id);

      logger.info('Google OAuth login successful', { userId: user.id, email });

      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 7 * 24 * 60 * 60,
        user,
        profile: profile || undefined,
      };
    } catch (error) {
      logger.error('Google OAuth callback error', error);
      throw new UnauthorizedError('Google OAuth authentication failed');
    }
  }
}

export const googleOAuthService = new GoogleOAuthService();

