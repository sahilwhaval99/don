import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User, LoginRequest, RegisterRequest, AuthResponse } from '@don/shared';
import { db } from '../db/index.js';

const JWT_EXPIRES_IN_SECONDS = 900; // 15 minutes (short-lived access token)
const REFRESH_EXPIRES_IN_DAYS = 7;

export class AuthService {
  async register(req: RegisterRequest): Promise<AuthResponse> {
    const existing = Array.from(db.users.values()).find((u) => u.email === req.email);
    if (existing) {
      throw new Error('User with this email already exists.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(req.password, salt);

    const newUser: User & { passwordHash: string } = {
      id: crypto.randomUUID(),
      email: req.email,
      name: req.name,
      role: db.users.size === 0 ? 'OWNER' : 'MEMBER',
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.users.set(newUser.id, newUser);

    const { accessToken, refreshToken } = await this.generateTokens(newUser.id);

    const { passwordHash: _, ...userSafe } = newUser;
    return {
      user: userSafe,
      accessToken,
      refreshToken,
      expiresInSeconds: JWT_EXPIRES_IN_SECONDS,
    };
  }

  async login(req: LoginRequest): Promise<AuthResponse> {
    const user = Array.from(db.users.values()).find((u) => u.email === req.email);
    if (!user) {
      throw new Error('Invalid email or password credentials.');
    }

    const isValid = await bcrypt.compare(req.password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid email or password credentials.');
    }

    const { accessToken, refreshToken } = await this.generateTokens(user.id);

    const { passwordHash: _, ...userSafe } = user;
    return {
      user: userSafe,
      accessToken,
      refreshToken,
      expiresInSeconds: JWT_EXPIRES_IN_SECONDS,
    };
  }

  async refreshTokens(oldRefreshToken: string): Promise<AuthResponse> {
    const tokenRecord = db.refreshTokens.get(oldRefreshToken);
    if (!tokenRecord || tokenRecord.revoked || new Date() > tokenRecord.expiresAt) {
      throw new Error('Invalid or expired refresh token. Re-authentication required.');
    }

    // Revoke old token to enforce refresh token rotation
    tokenRecord.revoked = true;
    db.refreshTokens.set(oldRefreshToken, tokenRecord);

    const user = db.users.get(tokenRecord.userId);
    if (!user) throw new Error('User not found.');

    const { accessToken, refreshToken } = await this.generateTokens(user.id);
    const { passwordHash: _, ...userSafe } = user;

    return {
      user: userSafe,
      accessToken,
      refreshToken,
      expiresInSeconds: JWT_EXPIRES_IN_SECONDS,
    };
  }

  private async generateTokens(userId: string): Promise<{ accessToken: string; refreshToken: string }> {
    // Generate secure random refresh token
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRES_IN_DAYS);

    db.refreshTokens.set(refreshToken, {
      tokenHash: refreshToken,
      userId,
      revoked: false,
      expiresAt,
    });

    // Generate pseudo access token for standard JWT flow
    const accessToken = Buffer.from(
      JSON.stringify({
        sub: userId,
        exp: Math.floor(Date.now() / 1000) + JWT_EXPIRES_IN_SECONDS,
        iat: Math.floor(Date.now() / 1000),
      })
    ).toString('base64');

    return { accessToken, refreshToken };
  }
}

export const authService = new AuthService();
