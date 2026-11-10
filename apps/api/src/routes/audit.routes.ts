import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { auditService } from '../services/audit.service.js';

export async function auditRoutes(fastify: FastifyInstance) {
  // Query Audit Logs
  fastify.get('/api/audit', async (req, reply) => {
    const owner = Array.from(db.users.values())[0];
    const userId = owner?.id || '00000000-0000-0000-0000-000000000001';
    const logs = auditService.getLogs(userId, 100);
    return reply.status(200).send(logs);
  });

  // Privacy Center: Full User Data Export (GDPR / Privacy Respecting)
  fastify.get('/api/privacy/export', async (_req, reply) => {
    const owner = Array.from(db.users.values())[0];
    const userId = owner?.id || '00000000-0000-0000-0000-000000000001';

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      user: owner ? { id: owner.id, email: owner.email, name: owner.name, role: owner.role } : null,
      tasks: Array.from(db.tasks.values()).filter((t) => t.userId === userId),
      projects: Array.from(db.projects.values()).filter((p) => p.userId === userId),
      goals: Array.from(db.goals.values()).filter((g) => g.userId === userId),
      routines: Array.from(db.routines.values()).filter((r) => r.userId === userId),
      memories: Array.from(db.memories.values()).filter((m) => m.userId === userId),
      documents: Array.from(db.documents.values()).filter((d) => d.userId === userId),
      devices: Array.from(db.devices.values()).filter((d) => d.userId === userId),
      allowlistedApps: Array.from(db.allowlistedApps.values()).filter((a) => a.userId === userId),
      automations: Array.from(db.automations.values()).filter((a) => a.userId === userId),
      auditLogs: db.auditLogs.filter((l) => l.userId === userId),
    };

    return reply.status(200).send(exportPayload);
  });

  // Privacy Center: Account & Data Deletion
  fastify.post('/api/privacy/delete-account', async (req, reply) => {
    const body = req.body as { confirmDeletion: boolean };
    if (!body.confirmDeletion) {
      return reply.status(400).send({ error: 'Explicit confirmation flag required for account erasure.' });
    }

    db.reset();
    return reply.status(200).send({
      message: 'All personal data, connected records, memories, and devices have been purged.',
    });
  });
}
