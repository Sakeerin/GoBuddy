// User and authentication types

export interface User {
  id: string;
  email: string;
  email_verified: boolean;
  name?: string;
  avatar_url?: string;
  auth_provider: 'email' | 'google' | 'apple';
  created_at: Date;
  updated_at: Date;
}

export interface UserProfile {
  user_id: string;
  language: string; // ISO 639-1 code (e.g., 'en', 'th')
  currency: string; // ISO 4217 code (e.g., 'THB', 'USD')
  distance_unit: 'km' | 'miles';
  dietary_restrictions: string[]; // e.g., ['vegetarian', 'vegan', 'halal']
  mobility_constraints: string[]; // e.g., ['wheelchair', 'limited_walking']
  travel_preferences: {
    budget: 'budget' | 'mid' | 'luxury';
    comfort: 'basic' | 'comfortable' | 'premium';
    adventure: 'low' | 'medium' | 'high';
  };
  created_at: Date;
  updated_at: Date;
}

export interface GuestSession {
  session_id: string;
  created_at: Date;
  expires_at: Date;
}

export interface AuthToken {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user: User;
  profile?: UserProfile;
}

export interface OTPRequest {
  email: string;
}

export interface OTPVerify {
  email: string;
  otp: string;
}

export interface GoogleOAuthRequest {
  code: string;
  redirect_uri: string;
}

export interface MoveTripToAccountRequest {
  guest_session_id: string;
  trip_ids: string[];
}

