import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../../server.js';
import { db } from '../../db/index.js';

describe('DON API Integration Tests (Disposable Database)', () => {
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

  it('GET /health returns 200 and healthy status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.status).toBe('healthy');
    expect(json.version).toBe('1.0.0');
    expect(json.killSwitchActive).toBe(false);
  });

  it('GET /status reports Cloud Run deployment readiness', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/status',
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.service).toContain('DON');
    expect(json.deployment).toBe('Cloud Run Ready');
  });

  it('POST /api/auth/login authenticates default owner', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'owner@don.internal',
        password: 'password123',
      },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.user.email).toBe('owner@don.internal');
    expect(json.accessToken).toBeTruthy();
  });

  it('POST /api/tasks creates task and writes audit record', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: {
        title: 'Review production firewall rules',
        priority: 'HIGH',
        labels: ['devops', 'security'],
      },
    });

    expect(res.statusCode).toBe(201);
    const task = JSON.parse(res.body);
    expect(task.title).toBe('Review production firewall rules');
    expect(task.priority).toBe('HIGH');

    // Verify task is retrievable
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/tasks',
    });
    const tasks = JSON.parse(listRes.body);
    expect(tasks.some((t: { id: string }) => t.id === task.id)).toBe(true);

    // Verify audit record was created
    expect(db.auditLogs.some((l) => l.toolName === 'create_task')).toBe(true);
  });

  it('POST /api/chat proposes tool and registers pending approval', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        message: 'Open calculator app on desktop',
      },
    });

    expect(res.statusCode).toBe(200);
    const chatRes = JSON.parse(res.body);
    expect(chatRes.toolProposals.length).toBeGreaterThan(0);
    const proposal = chatRes.toolProposals[0];
    expect(proposal.toolName).toBe('propose_open_desktop_app');
    expect(proposal.requiresApproval).toBe(true);

    // Verify approval request was recorded in pending approvals
    const approvalListRes = await app.inject({
      method: 'GET',
      url: '/api/approvals',
    });
    const pending = JSON.parse(approvalListRes.body);
    expect(pending.some((p: { id: string }) => p.id === proposal.id)).toBe(true);
  });

  it('POST /api/approvals/:id/decide rejects execution when user DENIES', async () => {
    // 1. Propose action via chat
    const chatRes = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { message: 'Call +1-555-0199' },
    });
    const { toolProposals } = JSON.parse(chatRes.body);
    const proposalId = toolProposals[0].id;

    // 2. Deny proposal
    const decisionRes = await app.inject({
      method: 'POST',
      url: `/api/approvals/${proposalId}/decide`,
      payload: { decision: 'DENY' },
    });

    expect(decisionRes.statusCode).toBe(200);
    const result = JSON.parse(decisionRes.body);
    expect(result.status).toBe('DENIED');

    // 3. Verify audit record reflects explicit user denial
    const deniedLog = db.auditLogs.find((l) => l.status === 'DENIED');
    expect(deniedLog).toBeDefined();
    expect(deniedLog?.decisionMadeBy).toBe('USER');
  });

  it('POST /api/automations/kill-switch engages emergency halt', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/automations/kill-switch',
      payload: {
        activate: true,
        reason: 'Suspicious automation behavior detected',
      },
    });

    expect(res.statusCode).toBe(200);
    const status = JSON.parse(res.body);
    expect(status.isActivated).toBe(true);
    expect(db.killSwitch.isActivated).toBe(true);

    // Verify subsequent tool execution in chat is locked
    const chatRes = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { message: 'Run automation now' },
    });
    const chatJson = JSON.parse(chatRes.body);
    expect(chatJson.reply).toContain('EMERGENCY KILL SWITCH ACTIVE');
  });

  it('GET /api/privacy/export exports complete user data', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/privacy/export',
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data).toHaveProperty('user');
    expect(data).toHaveProperty('tasks');
    expect(data).toHaveProperty('auditLogs');
    expect(data).toHaveProperty('memories');
  });
});
