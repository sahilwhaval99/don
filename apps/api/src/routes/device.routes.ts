import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { DeviceType, AllowlistedApp } from '@don/shared';
import { db } from '../db/index.js';
import { relayService } from '../services/relay.service.js';
import { auditService } from '../services/audit.service.js';

export async function deviceRoutes(fastify: FastifyInstance) {
  // List paired devices
  fastify.get('/api/devices', async (_req, reply) => {
    return reply.status(200).send(Array.from(db.devices.values()));
  });

  // Generate Pairing Token & QR Code Payload
  fastify.post('/api/devices/pairing-token', async (req, reply) => {
    const body = req.body as { deviceType: DeviceType };
    const owner = Array.from(db.users.values())[0];
    const userId = owner?.id || '00000000-0000-0000-0000-000000000001';

    const tokenObj = relayService.generatePairingToken(userId, body.deviceType || 'ANDROID_COMPANION');
    return reply.status(200).send(tokenObj);
  });

  // Pair Device with Token (supports both direct and companion aliases)
  const handlePairDevice = async (req: any, reply: any) => {
    const body = req.body as {
      token?: string;
      pairingToken?: string;
      deviceName?: string;
      name?: string;
      publicKey?: string;
    };
    const token = body.token || body.pairingToken;
    const deviceName = body.deviceName || body.name || 'Companion Device';

    if (!token) {
      return reply.status(400).send({ error: 'Pairing token is required.' });
    }

    try {
      const device = relayService.pairDevice(token, deviceName, body.publicKey);
      auditService.record({
        userId: device.userId,
        deviceId: device.id,
        deviceType: device.deviceType,
        toolName: 'pair_companion_device',
        parameters: { deviceName: device.name },
        targetResource: `DEVICE:${device.id}`,
        consequenceSummary: `Securely paired companion device "${device.name}" (${device.deviceType})`,
        status: 'EXECUTED',
        decisionMadeBy: 'USER',
      });

      return reply.status(201).send(device);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Pairing failed';
      return reply.status(400).send({ error: msg });
    }
  };

  fastify.post('/api/devices/pair', handlePairDevice);
  fastify.post('/api/v1/devices/pair', handlePairDevice);

  // Allowlisted Apps for Desktop Agent
  fastify.get('/api/devices/allowlisted-apps', async (_req, reply) => {
    return reply.status(200).send(Array.from(db.allowlistedApps.values()));
  });

  fastify.post('/api/devices/allowlisted-apps', async (req, reply) => {
    const body = req.body as { appName: string; executablePath: string; icon?: string };
    if (!body.appName || !body.executablePath) {
      return reply.status(400).send({ error: 'App name and fixed executable path are required.' });
    }

    const owner = Array.from(db.users.values())[0];
    const newApp: AllowlistedApp = {
      id: crypto.randomUUID(),
      userId: owner?.id || '00000000-0000-0000-0000-000000000001',
      appName: body.appName,
      executablePath: body.executablePath,
      icon: body.icon || 'app-window',
      permissionLevel: 'LAUNCH_ONLY',
      isEnabled: true,
      createdAt: new Date().toISOString(),
    };

    db.allowlistedApps.set(newApp.id, newApp);
    return reply.status(201).send(newApp);
  });

  // Screen capture session request
  fastify.post('/api/devices/screen-capture', async (req, reply) => {
    const body = req.body as { windowTitle?: string; purpose?: string };
    const owner = Array.from(db.users.values())[0];

    // Check Kill Switch
    if (db.killSwitch.isActivated) {
      return reply.status(403).send({ error: 'Screen capture blocked by emergency kill switch.' });
    }

    const sessionId = crypto.randomUUID();
    relayService.broadcast({
      id: crypto.randomUUID(),
      type: 'CAPTURE_SCREEN',
      payload: { sessionId, windowTitle: body.windowTitle || 'Active Window' },
      timestamp: new Date().toISOString(),
    });

    return reply.status(200).send({
      sessionId,
      status: 'ACTIVE_SHARING_REQUESTED',
      transient: true,
      notice: 'Active sharing indicator must be visible on desktop. Image deleted immediately following analysis.',
    });
  });

  // Phone Call Proposal
  fastify.post('/api/devices/propose-call', async (req, reply) => {
    const body = req.body as {
      phoneNumber: string;
      contactName?: string;
      callType: 'DIALER_ONLY' | 'DIRECT_CALL';
    };

    if (!body.phoneNumber) {
      return reply.status(400).send({ error: 'Phone number required' });
    }

    const proposalId = crypto.randomUUID();
    return reply.status(200).send({
      proposalId,
      phoneNumber: body.phoneNumber,
      contactName: body.contactName,
      callType: body.callType,
      requiresPhoneSideApproval: true,
      notice:
        body.callType === 'DIRECT_CALL'
          ? 'Outgoing call initiated only after explicit Android phone-side confirmation.'
          : 'Android dialer will open with number populated.',
    });
  });

  // Companion Approval Resolution Endpoint (Android/Desktop phone-side resolution)
  const handleApprovalResponse = async (req: any, reply: any) => {
    const body = req.body as {
      approvalId: string;
      approved: boolean;
      decisionDevice?: string;
      timestamp?: string;
    };

    if (!body.approvalId) {
      return reply.status(400).send({ error: 'approvalId is required.' });
    }

    const proposal = db.approvals.get(body.approvalId);
    if (!proposal) {
      return reply.status(404).send({ error: 'Approval request not found or expired.' });
    }

    if (body.approved && db.killSwitch.isActivated) {
      return reply.status(403).send({ error: 'Action blocked by active Emergency Kill Switch.' });
    }

    proposal.status = body.approved ? 'APPROVED' : 'REJECTED';
    db.approvals.set(body.approvalId, proposal);

    auditService.record({
      userId: proposal.userId,
      deviceId: body.decisionDevice,
      deviceType: 'ANDROID_COMPANION',
      toolName: proposal.toolName,
      parameters: proposal.parameters,
      targetResource: proposal.consequence.target,
      consequenceSummary: body.approved
        ? `User approved consequential action via ${body.decisionDevice || 'Android companion'}`
        : `User explicitly denied consequential action via ${body.decisionDevice || 'Android companion'}`,
      status: body.approved ? 'APPROVED' : 'DENIED',
      decisionMadeBy: 'USER',
    });

    relayService.broadcast({
      id: crypto.randomUUID(),
      type: 'APPROVAL_DECISION',
      payload: {
        approvalId: body.approvalId,
        approved: body.approved,
        decisionDevice: body.decisionDevice || 'ANDROID_COMPANION',
      },
      timestamp: new Date().toISOString(),
    });

    return reply.status(200).send({
      success: true,
      approvalId: body.approvalId,
      status: proposal.status,
    });
  };

  fastify.post('/api/devices/relay/approval-response', handleApprovalResponse);
  fastify.post('/api/v1/devices/relay/approval-response', handleApprovalResponse);

  // Companion WebSocket Relay Endpoint (Local mDNS + Cloud Relay)
  const handleRelayWebSocket = (connection: any, _req: any) => {
    const ws = connection?.socket || connection;
    relayService.registerSocket(ws);

    ws.on('message', (message: any) => {
      try {
        const text = typeof message === 'string' ? message : message.toString();
        const data = JSON.parse(text);
        if (data.type === 'HEARTBEAT') {
          ws.send(JSON.stringify({ type: 'HEARTBEAT_ACK', timestamp: new Date().toISOString() }));
        }
      } catch {
        // invalid message format safely ignored
      }
    });

    // Send initial handshake state
    ws.send(
      JSON.stringify({
        type: 'CONNECTED',
        killSwitchActive: db.killSwitch.isActivated,
        activeDevicesCount: db.devices.size,
        timestamp: new Date().toISOString(),
      })
    );
  };

  fastify.get('/api/devices/relay/ws', { websocket: true }, handleRelayWebSocket);
  fastify.get('/api/v1/devices/relay/ws', { websocket: true }, handleRelayWebSocket);
}
