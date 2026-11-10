import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '../../services/auth.service.js';
import { db } from '../../db/index.js';

describe('AuthService Unit Tests', () => {
  let service: AuthService;

  beforeEach(() => {
    db.reset();
    service = new AuthService();
  });

  it('logs in default owner with seeded credentials', async () => {
    const res = await service.login({
      email: 'owner@don.internal',
      password: 'password123',
    });

    expect(res.user.email).toBe('owner@don.internal');
    expect(res.accessToken).toBeTruthy();
    expect(res.refreshToken).toBeTruthy();
    expect(res.expiresInSeconds).toBe(900);
  });

  it('rejects invalid password attempt', async () => {
    await expect(
      service.login({
        email: 'owner@don.internal',
        password: 'incorrectPassword!',
      })
    ).rejects.toThrow('Invalid email or password credentials');
  });

  it('registers new user and hashes password', async () => {
    const res = await service.register({
      email: 'newuser@don.internal',
      password: 'MySecurePassword456!',
      name: 'Test Engineer',
    });

    expect(res.user.name).toBe('Test Engineer');
    expect(res.user.email).toBe('newuser@don.internal');
    // Verify password is not exposed in safe user object
    expect(res.user).not.toHaveProperty('passwordHash');
  });

  it('enforces refresh token rotation', async () => {
    const loginRes = await service.login({
      email: 'owner@don.internal',
      password: 'password123',
    });

    const oldRefreshToken = loginRes.refreshToken;
    const rotatedRes = await service.refreshTokens(oldRefreshToken);

    expect(rotatedRes.accessToken).toBeTruthy();
    expect(rotatedRes.refreshToken).not.toBe(oldRefreshToken);

    // Old refresh token must now be revoked and rejected
    await expect(service.refreshTokens(oldRefreshToken)).rejects.toThrow('Invalid or expired refresh token');
  });
});
