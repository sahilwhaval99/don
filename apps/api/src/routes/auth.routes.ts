import { FastifyInstance } from 'fastify';
import { LoginRequestSchema, RegisterRequestSchema, RefreshTokenRequestSchema } from '@don/shared';
import { authService } from '../services/auth.service.js';
import { db } from '../db/index.js';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/api/auth/register', async (request, reply) => {
    try {
      const parsed = RegisterRequestSchema.parse(request.body);
      const res = await authService.register(parsed);
      return reply.status(201).send(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      return reply.status(400).send({ error: msg });
    }
  });

  fastify.post('/api/auth/login', async (request, reply) => {
    try {
      const parsed = LoginRequestSchema.parse(request.body);
      const res = await authService.login(parsed);
      return reply.status(200).send(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed.';
      return reply.status(401).send({ error: msg });
    }
  });

  fastify.post('/api/auth/refresh', async (request, reply) => {
    try {
      const parsed = RefreshTokenRequestSchema.parse(request.body);
      const res = await authService.refreshTokens(parsed.refreshToken);
      return reply.status(200).send(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Token refresh failed.';
      return reply.status(401).send({ error: msg });
    }
  });

  fastify.get('/api/auth/me', async (request, reply) => {
    // In our lightweight authenticated flow, fetch default owner or extract from header
    const defaultUser = Array.from(db.users.values())[0];
    if (!defaultUser) return reply.status(404).send({ error: 'No user registered' });
    const { passwordHash: _, ...safeUser } = defaultUser;
    return reply.status(200).send(safeUser);
  });
}
