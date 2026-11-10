import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { Document, SupportedDocType } from '@don/shared';
import { DocumentRAGAnalyzer } from '@don/ai';
import { db } from '../db/index.js';

const ragAnalyzer = new DocumentRAGAnalyzer();

export async function documentRoutes(fastify: FastifyInstance) {
  // List documents
  fastify.get('/api/documents', async (_req, reply) => {
    return reply.status(200).send(Array.from(db.documents.values()));
  });

  // Upload and parse document
  fastify.post('/api/documents', async (req, reply) => {
    const body = req.body as {
      name: string;
      fileType: SupportedDocType;
      rawText: string;
      tags?: string[];
    };

    if (!body.name || !body.rawText) {
      return reply.status(400).send({ error: 'Document name and text content are required.' });
    }

    const owner = Array.from(db.users.values())[0];
    const newDoc: Document = {
      id: crypto.randomUUID(),
      userId: owner?.id || '00000000-0000-0000-0000-000000000001',
      name: body.name,
      fileType: body.fileType || 'MARKDOWN',
      sizeBytes: Buffer.byteLength(body.rawText, 'utf8'),
      pageCount: Math.max(1, Math.ceil(body.rawText.split('\n').length / 40)),
      rawText: body.rawText,
      summary: body.rawText.slice(0, 160) + '...',
      tags: body.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.documents.set(newDoc.id, newDoc);

    // Reindex
    ragAnalyzer.indexDocuments(Array.from(db.documents.values()));

    return reply.status(201).send(newDoc);
  });

  // Query documents with citations
  fastify.post('/api/documents/query', async (req, reply) => {
    const body = req.body as { question: string };
    if (!body.question) {
      return reply.status(400).send({ error: 'Question parameter is required.' });
    }

    ragAnalyzer.indexDocuments(Array.from(db.documents.values()));
    const result = ragAnalyzer.searchAndAnswer(body.question);

    return reply.status(200).send(result);
  });
}
