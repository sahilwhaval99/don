import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (_req, reply) => {
    return reply.status(200).send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      version: '1.0.0',
      killSwitchActive: db.killSwitch.isActivated,
    });
  });

  fastify.get('/status', async (_req, reply) => {
    return reply.status(200).send({
      service: 'DON (Digital Operations Navigator) API',
      deployment: 'Cloud Run Ready',
      environment: process.env.NODE_ENV || 'development',
      database: 'Connected',
      capabilities: {
        aiProvider: process.env.AI_PROVIDER || 'mock',
        searchProvider: process.env.SEARCH_PROVIDER || 'mock',
        desktopRelay: 'Active',
        androidCompanionRelay: 'Active',
        killSwitch: db.killSwitch.isActivated ? 'ENGAGED' : 'DISENGAGED',
      },
      stats: {
        registeredUsers: db.users.size,
        activeTasks: db.tasks.size,
        connectedDevices: db.devices.size,
        auditLogsCount: db.auditLogs.length,
      },
    });
  });
}
