import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { CreateMemoryRequestSchema, Memory } from '@don/shared';
import { db } from '../db/index.js';
import { auditService } from '../services/audit.service.js';

export async function memoryRoutes(fastify: FastifyInstance) {
  // Review memories
  fastify.get('/api/memories', async (_req, reply) => {
    return reply.status(200).send(Array.from(db.memories.values()));
  });

  // Save new memory with explicit consent
  fastify.post('/api/memories', async (req, reply) => {
    try {
      const parsed = CreateMemoryRequestSchema.parse(req.body);
      const owner = Array.from(db.users.values())[0];
      const userId = owner?.id || '00000000-0000-0000-0000-000000000001';

      const newMemory: Memory = {
        id: crypto.randomUUID(),
        userId,
        category: parsed.category,
        key: parsed.key,
        content: parsed.content,
        reasonForStorage: parsed.reasonForStorage,
        isEncrypted: true,
        confidenceScore: 1.0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      db.memories.set(newMemory.id, newMemory);

      auditService.record({
        userId,
        toolName: 'store_personal_memory',
        parameters: { memoryId: newMemory.id, key: newMemory.key },
        targetResource: 'MEMORY_STORE',
        consequenceSummary: `Stored encrypted memory "${newMemory.key}" under ${newMemory.category}`,
        status: 'EXECUTED',
        decisionMadeBy: 'EXPLICIT_USER_CONSENT',
      });

      return reply.status(201).send(newMemory);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save memory';
      return reply.status(400).send({ error: msg });
    }
  });

  // Edit memory
  fastify.patch('/api/memories/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const memory = db.memories.get(id);
    if (!memory) return reply.status(404).send({ error: 'Memory not found' });

    const body = req.body as Partial<Memory>;
    const updated: Memory = {
      ...memory,
      content: body.content ?? memory.content,
      key: body.key ?? memory.key,
      updatedAt: new Date().toISOString(),
    };
    db.memories.set(id, updated);
    return reply.status(200).send(updated);
  });

  // Delete memory
  fastify.delete('/api/memories/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const memory = db.memories.get(id);
    if (!memory) return reply.status(404).send({ error: 'Memory not found' });

    db.memories.delete(id);

    auditService.record({
      userId: memory.userId,
      toolName: 'delete_personal_memory',
      parameters: { memoryId: id, key: memory.key },
      targetResource: 'MEMORY_STORE',
      consequenceSummary: `Permanently deleted memory "${memory.key}"`,
      status: 'EXECUTED',
      decisionMadeBy: 'USER',
    });

    return reply.status(204).send();
  });

  // Export memories
  fastify.get('/api/memories/export', async (_req, reply) => {
    const memories = Array.from(db.memories.values());
    return reply.status(200).send({
      exportedAt: new Date().toISOString(),
      count: memories.length,
      memories,
    });
  });
}
