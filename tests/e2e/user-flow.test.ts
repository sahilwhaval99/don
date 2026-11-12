import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../../apps/api/src/server.js';
import { db } from '../../apps/api/src/db/index.js';

describe('Round 8: End-to-End User Flow (Login, Task, Search, Citations, Confirmation Denial)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    db.reset();
  });

  it('executes full operator workflow end-to-end', async () => {
    // 1. Authenticate user
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'owner@don.internal', password: 'password123' },
    });
    expect(loginRes.statusCode).toBe(200);
    const { accessToken, user } = JSON.parse(loginRes.body);
    expect(accessToken).toBeTruthy();
    expect(user.role).toBe('OWNER');

    // 2. Create high-priority task with due date
    const taskRes = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: 'Conduct weekly security audit',
        priority: 'HIGH',
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        labels: ['security', 'compliance'],
      },
    });
    expect(taskRes.statusCode).toBe(201);
    const task = JSON.parse(taskRes.body);
    expect(task.title).toBe('Conduct weekly security audit');

    // 3. Perform web search through chat interface and verify source citation
    const searchRes = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        message: 'search for typescript latest updates',
      },
    });
    expect(searchRes.statusCode).toBe(200);
    const searchData = JSON.parse(searchRes.body);
    expect(searchData.citations.length).toBeGreaterThan(0);
    expect(searchData.citations[0].url).toMatch(/^https?:\/\//);
    expect(searchData.citations[0].publishedDate).toBeDefined();

    // 4. Propose sensitive consequential tool (Open Desktop Application)
    const proposeRes = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        message: 'Open calculator app',
      },
    });
    expect(proposeRes.statusCode).toBe(200);
    const proposeData = JSON.parse(proposeRes.body);
    expect(proposeData.toolProposals.length).toBeGreaterThan(0);
    const proposal = proposeData.toolProposals[0];
    expect(proposal.requiresApproval).toBe(true);

    // 5. Operator explicitly denies confirmation
    const denialRes = await app.inject({
      method: 'POST',
      url: `/api/approvals/${proposal.id}/decide`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { decision: 'DENY' },
    });
    expect(denialRes.statusCode).toBe(200);
    const denialData = JSON.parse(denialRes.body);
    expect(denialData.status).toBe('DENIED');

    // 6. Verify audit center trail includes the explicit denial with USER decision
    const auditRes = await app.inject({
      method: 'GET',
      url: '/api/audit',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(auditRes.statusCode).toBe(200);
    const logs = JSON.parse(auditRes.body);
    const deniedEntry = logs.find((l: { status: string }) => l.status === 'DENIED');
    expect(deniedEntry).toBeDefined();
    expect(deniedEntry.decisionMadeBy).toBe('USER');
    expect(deniedEntry.toolName).toBe('propose_open_desktop_app');
  });
});
