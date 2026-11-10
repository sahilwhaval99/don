import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import { healthRoutes } from './routes/health.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { taskRoutes } from './routes/tasks.routes.js';
import { chatRoutes } from './routes/chat.routes.js';
import { memoryRoutes } from './routes/memory.routes.js';
import { documentRoutes } from './routes/document.routes.js';
import { deviceRoutes } from './routes/device.routes.js';
import { automationRoutes } from './routes/automation.routes.js';
import { auditRoutes } from './routes/audit.routes.js';

export function buildServer(): FastifyInstance {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: 'info' },
  });

  // Enable CORS for static web frontend, desktop agent, and extensions
  app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Enable WebSockets for Companion Relay
  app.register(websocket);

  // Global Rate Limiting: 120 requests/minute per IP
  app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });

  // Swagger Documentation
  app.register(swagger, {
    openapi: {
      info: {
        title: 'DON (Digital Operations Navigator) API',
        description: 'Secure, multi-device enterprise AI assistant API for Cloud Run',
        version: '1.0.0',
      },
    },
  });

  app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // Register Routes
  app.register(healthRoutes);
  app.register(authRoutes);
  app.register(taskRoutes);
  app.register(chatRoutes);
  app.register(memoryRoutes);
  app.register(documentRoutes);
  app.register(deviceRoutes);
  app.register(automationRoutes);
  app.register(auditRoutes);

  return app;
}
