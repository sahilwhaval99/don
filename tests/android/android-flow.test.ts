import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../../apps/api/src/server.js';
import { db } from '../../apps/api/src/db/index.js';
import { relayService, RelayMessage } from '../../apps/api/src/services/relay.service.js';
import { evaluateConsequence } from '../../packages/ai/src/index.js';

describe('Round 10: Android Mock / Companion Device Test Suite', () => {
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

  it('pairs Android companion device via token and establishes capabilities', () => {
    const owner = Array.from(db.users.values())[0];
    const pairing = relayService.generatePairingToken(owner.id, 'ANDROID_COMPANION');
    expect(pairing.token).toBeTruthy();

    const device = relayService.pairDevice(
      pairing.token,
      'Pixel 8 Pro (Owner)',
      'public-key-ed25519-mock-android'
    );

    expect(device.name).toBe('Pixel 8 Pro (Owner)');
    expect(device.deviceType).toBe('ANDROID_COMPANION');
    expect(device.capabilities).toContain('DIALER_INTENT');
    expect(device.capabilities).toContain('PUSH_APPROVAL');
    expect(device.capabilities).toContain('DIRECT_CALL_CONSENT');
  });

  it('pairs Android companion via HTTP endpoint using companion JSON payload', async () => {
    const owner = Array.from(db.users.values())[0];
    const pairing = relayService.generatePairingToken(owner.id, 'ANDROID_COMPANION');

    const res = await app.inject({
      method: 'POST',
      url: '/api/devices/pair',
      payload: {
        pairingToken: pairing.token,
        name: 'Android (Google Pixel 8 Pro)',
        deviceId: 'device-android-e2e',
        deviceType: 'ANDROID_COMPANION',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.name).toBe('Android (Google Pixel 8 Pro)');
    expect(body.deviceType).toBe('ANDROID_COMPANION');
    expect(body.status).toBe('PAIRED');
  });

  it('dispatches task notification when urgent task automation triggers', () => {
    let capturedMessage: RelayMessage | null = null;
    const listener = (msg: RelayMessage) => {
      capturedMessage = msg;
    };

    relayService.on('message', listener);

    // Broadcast urgent notification
    relayService.broadcast({
      id: 'notif-1',
      type: 'APPROVAL_REQUEST',
      payload: {
        title: 'Priority Milestone Approaching',
        body: 'Security architecture sign-off required today.',
      },
      timestamp: new Date().toISOString(),
    });

    expect(capturedMessage).not.toBeNull();
    expect(capturedMessage?.type).toBe('APPROVAL_REQUEST');
    expect(capturedMessage?.payload.title).toContain('Priority Milestone');

    relayService.off('message', listener);
  });

  it('safely handles dialer proposal and requires phone-side approval', () => {
    const consequence = evaluateConsequence('propose_phone_dial', {
      phoneNumber: '+1-555-0199',
    });

    expect(consequence.requiresApproval).toBe(true);
    expect(consequence.consequence.requiresAndroidCompanion).toBe(true);
    expect(consequence.consequence.riskLevel).toBe('MEDIUM');
    expect(consequence.consequence.target).toContain('+1-555-0199');
  });

  it('handles CALL_PHONE denial by falling back to non-direct dialer proposal', () => {
    const directCallConsequence = evaluateConsequence('propose_phone_call', {
      phoneNumber: '+1-555-0199',
    });
    expect(directCallConsequence.consequence.riskLevel).toBe('CRITICAL');

    // Simulate denied permission: fall back to propose_phone_dial
    const fallbackConsequence = evaluateConsequence('propose_phone_dial', {
      phoneNumber: '+1-555-0199',
      fallbackFromDeniedCallPermission: true,
    });
    expect(fallbackConsequence.consequence.riskLevel).toBe('MEDIUM');
    expect(fallbackConsequence.consequence.target).toContain('Android Dialer');
  });

  it('processes rejected call proposal via CallApprovalReceiver endpoint', async () => {
    const proposalId = '123e4567-e89b-12d3-a456-426614174000';
    db.approvals.set(proposalId, {
      id: proposalId,
      userId: '00000000-0000-0000-0000-000000000001',
      toolName: 'propose_phone_call',
      parameters: { phoneNumber: '+1-555-0199' },
      consequence: {
        target: '+1-555-0199',
        description: 'Direct phone call',
        isReversible: false,
        riskLevel: 'CRITICAL',
        requiresLocalAgent: false,
        requiresAndroidCompanion: true,
      },
      requiresApproval: true,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    });

    // Android companion resolves proposal via CallApprovalReceiver endpoint
    const res = await app.inject({
      method: 'POST',
      url: '/api/devices/relay/approval-response',
      payload: {
        approvalId: proposalId,
        approved: false,
        decisionDevice: 'ANDROID_COMPANION',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('REJECTED');
    expect(db.approvals.get(proposalId)?.status).toBe('REJECTED');

    // Verify audit record exists with DENIED status
    const auditRecord = db.auditLogs.find(
      (l) => l.toolName === 'propose_phone_call' && l.status === 'DENIED'
    );
    expect(auditRecord).toBeDefined();
    expect(auditRecord?.decisionMadeBy).toBe('USER');
  });

  it('processes approved call proposal via CallApprovalReceiver endpoint', async () => {
    const proposalId = '223e4567-e89b-12d3-a456-426614174001';
    db.approvals.set(proposalId, {
      id: proposalId,
      userId: '00000000-0000-0000-0000-000000000001',
      toolName: 'propose_phone_call',
      parameters: { phoneNumber: '+1-555-0199' },
      consequence: {
        target: '+1-555-0199',
        description: 'Direct phone call',
        isReversible: false,
        riskLevel: 'CRITICAL',
        requiresLocalAgent: false,
        requiresAndroidCompanion: true,
      },
      requiresApproval: true,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/devices/relay/approval-response',
      payload: {
        approvalId: proposalId,
        approved: true,
        decisionDevice: 'ANDROID_COMPANION',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('APPROVED');
    expect(db.approvals.get(proposalId)?.status).toBe('APPROVED');
  });

  it('blocks phone-side approval when Emergency Kill Switch is engaged', async () => {
    const proposalId = '323e4567-e89b-12d3-a456-426614174002';
    db.approvals.set(proposalId, {
      id: proposalId,
      userId: '00000000-0000-0000-0000-000000000001',
      toolName: 'propose_phone_call',
      parameters: { phoneNumber: '+1-555-0199' },
      consequence: {
        target: '+1-555-0199',
        description: 'Direct phone call',
        isReversible: false,
        riskLevel: 'CRITICAL',
        requiresLocalAgent: false,
        requiresAndroidCompanion: true,
      },
      requiresApproval: true,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    });

    // Activate Kill Switch
    db.killSwitch.isActivated = true;

    const res = await app.inject({
      method: 'POST',
      url: '/api/devices/relay/approval-response',
      payload: {
        approvalId: proposalId,
        approved: true,
        decisionDevice: 'ANDROID_COMPANION',
      },
    });

    expect(res.statusCode).toBe(403);
    expect(db.approvals.get(proposalId)?.status).toBe('PENDING');
  });

  it('cancels pending phone notifications when Emergency Kill Switch is engaged', () => {
    let killSwitchReceived = false;
    const listener = (msg: RelayMessage) => {
      if (msg.type === 'KILL_SWITCH_TRIGGERED' && msg.payload.isActivated) {
        killSwitchReceived = true;
      }
    };

    relayService.on('message', listener);
    relayService.notifyKillSwitch(true);

    expect(killSwitchReceived).toBe(true);
    relayService.off('message', listener);
  });
});
