import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import child_process from 'child_process';
import {
  DeviceType,
  AllowlistedApp,
  InstalledAppEntry,
  TrustedFastLaunchPolicySchema,
} from '@don/shared';
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
      trusted: false,
      createdAt: new Date().toISOString(),
    };

    db.allowlistedApps.set(newApp.id, newApp);
    return reply.status(201).send(newApp);
  });

  // Discovered / Installed Windows Apps Registry
  fastify.get('/api/devices/installed-apps', async (req, reply) => {
    const query = (req.query as { search?: string } | undefined)?.search?.trim().toLowerCase();
    let apps = Array.from(db.installedApps.values());
    if (query) {
      apps = apps.filter((a) => a.appName.toLowerCase().includes(query));
    }
    return reply.status(200).send(apps);
  });

  fastify.post('/api/devices/installed-apps', async (req, reply) => {
    const body = req.body as { apps?: Array<Partial<InstalledAppEntry>> };
    const incoming = Array.isArray(body?.apps) ? body.apps : [];
    for (const item of incoming) {
      if (!item.appName || !item.executablePath) continue;
      if (item.executablePath.includes('..') || /[;&|`$><\r\n]/.test(item.executablePath)) continue;
      const id = item.id || `app-${item.appName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const existing = db.installedApps.get(id);
      const entry: InstalledAppEntry = {
        id,
        appName: item.appName,
        executablePath: item.executablePath,
        launchArgs: item.launchArgs || [],
        source: item.source || 'START_MENU',
        trusted: existing ? existing.trusted : Boolean(item.trusted),
        autoApprove: existing ? existing.autoApprove : Boolean(item.autoApprove),
        publisher: item.publisher,
        icon: item.icon || 'app-window',
      };
      db.installedApps.set(id, entry);
    }
    return reply.status(200).send(Array.from(db.installedApps.values()));
  });

  // Trusted Fast-Launch Policy
  fastify.get('/api/devices/trusted-policy', async (_req, reply) => {
    const edgeBridgeConnected = relayService.getConnectedDeviceTypes().includes('BROWSER_EXTENSION');
    return reply.status(200).send({
      ...db.trustedPolicy,
      trustedFastLaunch: db.trustedPolicy.enabled,
      edgeBridgeConnected,
      installedApps: Array.from(db.installedApps.values()),
    });
  });

  const handleUpdateTrustedPolicy = async (req: any, reply: any) => {
    try {
      const raw = (req.body || {}) as {
        enabled?: boolean;
        mode?: 'REQUIRE_APPROVAL' | 'TRUSTED_FAST_LAUNCH' | 'ALLOWLIST_ONLY';
        trustedFastLaunch?: boolean;
        appId?: string;
        trusted?: boolean;
        trustedAppIds?: string[];
        trustedAppNames?: string[];
        enforceRegistryValidation?: boolean;
      };

      const parsed = TrustedFastLaunchPolicySchema.partial().parse({
        enabled: raw.enabled ?? raw.trustedFastLaunch,
        mode:
          raw.mode ??
          (typeof (raw.enabled ?? raw.trustedFastLaunch) === 'boolean'
            ? (raw.enabled ?? raw.trustedFastLaunch)
              ? 'TRUSTED_FAST_LAUNCH'
              : 'REQUIRE_APPROVAL'
            : undefined),
        trustedAppIds: raw.trustedAppIds,
        trustedAppNames: raw.trustedAppNames,
        enforceRegistryValidation: raw.enforceRegistryValidation,
      });

      const nextTrustedIds = new Set(
        (parsed.trustedAppIds ?? db.trustedPolicy.trustedAppIds).map((s) => s.toLowerCase())
      );
      const nextTrustedNames = new Set(
        (parsed.trustedAppNames ?? db.trustedPolicy.trustedAppNames).map((s) => s.toLowerCase())
      );

      if (raw.appId && typeof raw.trusted === 'boolean') {
        const targetIdLower = raw.appId.toLowerCase();
        const targetApp = db.installedApps.get(raw.appId) || db.allowlistedApps.get(raw.appId);
        if (raw.trusted) {
          nextTrustedIds.add(targetIdLower);
          if (targetApp) nextTrustedNames.add(targetApp.appName.toLowerCase());
        } else {
          nextTrustedIds.delete(targetIdLower);
          if (targetApp) nextTrustedNames.delete(targetApp.appName.toLowerCase());
        }
      }

      const updated = {
        ...db.trustedPolicy,
        ...parsed,
        trustedAppIds: Array.from(nextTrustedIds),
        trustedAppNames: Array.from(nextTrustedNames),
        updatedAt: new Date().toISOString(),
      };
      db.trustedPolicy = updated;

      for (const [id, app] of db.installedApps.entries()) {
        const isTrusted = nextTrustedIds.has(id.toLowerCase()) || nextTrustedNames.has(app.appName.toLowerCase());
        app.trusted = isTrusted;
        app.autoApprove = isTrusted;
        db.installedApps.set(id, app);
      }

      for (const [id, app] of db.allowlistedApps.entries()) {
        const isTrusted = nextTrustedIds.has(id.toLowerCase()) || nextTrustedNames.has(app.appName.toLowerCase());
        app.trusted = isTrusted;
        db.allowlistedApps.set(id, app);
      }

      relayService.broadcast({
        id: crypto.randomUUID(),
        type: 'TRUSTED_POLICY_UPDATED',
        payload: {
          globalEnabled: updated.enabled,
          mode: updated.mode,
          trustedApps: Array.from(db.installedApps.values()).map((a) => ({
            id: a.id,
            appName: a.appName,
            trusted: a.trusted,
          })),
        },
        timestamp: new Date().toISOString(),
      });

      const edgeBridgeConnected = relayService.getConnectedDeviceTypes().includes('BROWSER_EXTENSION');
      return reply.status(200).send({
        ...updated,
        trustedFastLaunch: updated.enabled,
        edgeBridgeConnected,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid trusted policy payload';
      return reply.status(400).send({ error: msg });
    }
  };

  fastify.post('/api/devices/trusted-policy', handleUpdateTrustedPolicy);
  fastify.put('/api/devices/trusted-policy', handleUpdateTrustedPolicy);

  // Open Website in Microsoft Edge (--new-tab)
  fastify.post('/api/devices/open-website', async (req, reply) => {
    if (db.killSwitch.isActivated) {
      return reply.status(403).send({ error: 'Action blocked by emergency kill switch.' });
    }

    const body = req.body as { url?: string; newTab?: boolean };
    const rawUrl = (body?.url || '').trim();
    if (!rawUrl) {
      return reply.status(400).send({ error: 'URL is required.' });
    }

    const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawUrl);
    let parsed: URL;
    try {
      parsed = new URL(hasScheme ? rawUrl : `https://${rawUrl}`);
    } catch {
      return reply.status(400).send({ error: `Invalid URL: ${rawUrl}` });
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return reply.status(400).send({ error: `Only http/https URLs are permitted (received ${parsed.protocol}).` });
    }

    const safeUrl = parsed.toString();
    const owner = Array.from(db.users.values())[0];

    relayService.broadcast({
      id: crypto.randomUUID(),
      type: 'EDGE_OPEN_NEW_TAB',
      payload: { url: safeUrl, newTab: body?.newTab !== false, browser: 'msedge' },
      timestamp: new Date().toISOString(),
    });

    if (process.platform === 'win32') {
      try {
        const child = child_process.spawn('msedge.exe', ['--new-tab', safeUrl], {
          detached: true,
          stdio: 'ignore',
        });
        if (child && typeof child.on === 'function') {
          child.on('error', () => { /* ignore */ });
        }
        child.unref();
      } catch {
        // ignore spawn errors if Edge is handled by extension relay
      }
    }

    auditService.record({
      userId: owner?.id || '00000000-0000-0000-0000-000000000001',
      deviceType: 'BROWSER_EXTENSION',
      toolName: 'open_new_tab',
      parameters: { url: safeUrl, browser: 'msedge' },
      targetResource: safeUrl,
      consequenceSummary: `Opened ${safeUrl} in Microsoft Edge new tab`,
      status: 'EXECUTED',
      decisionMadeBy: 'USER',
    });

    return reply.status(200).send({
      success: true,
      browser: 'msedge',
      url: safeUrl,
      newTab: true,
    });
  });

  // WhatsApp Document Search & Open
  const handleWhatsAppSearchDocument = async (req: any, reply: any) => {
    if (db.killSwitch.isActivated) {
      return reply.status(403).send({ error: 'WhatsApp document search blocked by emergency kill switch.' });
    }

    const body = (req.body || req.query || {}) as {
      query?: string;
      keyword?: string;
      contactName?: string;
      openFirst?: boolean;
      searchDirs?: string[];
    };
    const query = (body.query || body.keyword || '').trim();
    if (!query) {
      return reply.status(400).send({ error: 'Search query is required.' });
    }

    const home = os.homedir();
    const dirs = Array.isArray(body.searchDirs) && body.searchDirs.length > 0
      ? body.searchDirs
      : [
          path.join(home, 'Downloads'),
          path.join(home, 'Documents', 'WhatsApp'),
          path.join(home, 'Downloads', 'WhatsApp'),
        ];

    const safeExts = new Set(['.pdf', '.docx', '.doc', '.xlsx', '.pptx', '.txt', '.md', '.csv']);
    const matches: Array<{ name: string; path: string; sizeBytes: number; extension: string }> = [];
    const lowerQ = query.toLowerCase();

    for (const dir of dirs) {
      try {
        if (!fs.existsSync(dir)) continue;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (!entry.isFile()) continue;
          const ext = path.extname(entry.name).toLowerCase();
          if (!safeExts.has(ext)) continue;
          if (!entry.name.toLowerCase().includes(lowerQ)) continue;
          const full = path.resolve(dir, entry.name);
          const stat = fs.statSync(full);
          matches.push({ name: entry.name, path: full, sizeBytes: stat.size, extension: ext });
        }
      } catch {
        // ignore unreadable directories
      }
    }

    relayService.broadcast({
      id: crypto.randomUUID(),
      type: 'WHATSAPP_SEARCH_DOCUMENT',
      payload: {
        query,
        contactName: body.contactName,
        openFirst: Boolean(body.openFirst),
        localMatchCount: matches.length,
      },
      timestamp: new Date().toISOString(),
    });

    const owner = Array.from(db.users.values())[0];
    auditService.record({
      userId: owner?.id || '00000000-0000-0000-0000-000000000001',
      deviceType: 'DESKTOP_AGENT',
      toolName: 'whatsapp_search_download_open',
      parameters: { query, contactName: body.contactName },
      targetResource: 'WHATSAPP_DOCUMENTS',
      consequenceSummary: `Searched Downloads/WhatsApp for "${query}" (${matches.length} local match(es))`,
      status: 'EXECUTED',
      decisionMadeBy: 'USER',
    });

    return reply.status(200).send({
      query,
      contactName: body.contactName || null,
      matches,
      dispatchedToRelay: true,
    });
  };

  fastify.post('/api/whatsapp/search-document', handleWhatsAppSearchDocument);
  fastify.get('/api/whatsapp/search-document', handleWhatsAppSearchDocument);

  // WhatsApp Call (whatsapp:// protocol + Edge WhatsApp Web bridge)
  fastify.post('/api/whatsapp/call', async (req, reply) => {
    if (db.killSwitch.isActivated) {
      return reply.status(403).send({ error: 'WhatsApp call blocked by emergency kill switch.' });
    }

    const body = req.body as {
      contactName?: string;
      contact?: string;
      phoneNumber?: string;
      callType?: 'VOICE' | 'VIDEO';
    };
    const contactName = (body?.contactName || body?.contact)?.trim();
    const phoneNumber = body?.phoneNumber?.trim();

    if (!contactName && !phoneNumber) {
      return reply.status(400).send({ error: 'Either contactName or phoneNumber is required.' });
    }

    const callId = crypto.randomUUID();
    const cleanPhone = (phoneNumber || '').replace(/[^\d+]/g, '');
    const protocolUri = cleanPhone ? `whatsapp://call?phone=${encodeURIComponent(cleanPhone)}` : 'whatsapp://';

    relayService.broadcast({
      id: callId,
      type: 'WHATSAPP_CALL',
      payload: {
        callId,
        contactName: contactName || null,
        phoneNumber: phoneNumber || null,
        callType: body?.callType || 'VOICE',
        protocolUri,
      },
      timestamp: new Date().toISOString(),
    });

    const owner = Array.from(db.users.values())[0];
    auditService.record({
      userId: owner?.id || '00000000-0000-0000-0000-000000000001',
      deviceType: 'DESKTOP_AGENT',
      toolName: 'whatsapp_call',
      parameters: { contactName, phoneNumber, callType: body?.callType || 'VOICE' },
      targetResource: contactName || phoneNumber || 'WHATSAPP',
      consequenceSummary: `Initiated WhatsApp ${body?.callType || 'VOICE'} call to ${contactName || phoneNumber}`,
      status: 'EXECUTED',
      decisionMadeBy: 'USER',
    });

    return reply.status(200).send({
      success: true,
      callId,
      contactName: contactName || null,
      phoneNumber: phoneNumber || null,
      callType: body?.callType || 'VOICE',
      protocolUri,
      dispatchedToRelay: true,
    });
  });

  // WhatsApp Document Downloaded notification (from Edge Extension -> Desktop Agent)
  fastify.post('/api/whatsapp/document-downloaded', async (req, reply) => {
    if (db.killSwitch.isActivated) {
      return reply.status(403).send({ error: 'Action blocked by emergency kill switch.' });
    }

    const body = (req.body || {}) as {
      fileName?: string;
      filePath?: string;
      keyword?: string;
      chatName?: string;
      openInEdge?: boolean;
    };

    const payload = {
      fileName: body.fileName || null,
      filePath: body.filePath || null,
      keyword: body.keyword || null,
      chatName: body.chatName || null,
      openInEdge: body.openInEdge !== false,
    };

    relayService.broadcast({
      id: crypto.randomUUID(),
      type: 'WHATSAPP_DOCUMENT_FOUND',
      targetDeviceType: 'DESKTOP_AGENT',
      payload,
      timestamp: new Date().toISOString(),
    });

    const owner = Array.from(db.users.values())[0];
    auditService.record({
      userId: owner?.id || '00000000-0000-0000-0000-000000000001',
      deviceType: 'BROWSER_EXTENSION',
      toolName: 'whatsapp_search_download_open',
      parameters: payload,
      targetResource: body.fileName || body.keyword || 'WHATSAPP_DOCUMENT',
      consequenceSummary: `WhatsApp document downloaded (${body.fileName || body.keyword || 'document'}) and forwarded to Desktop Agent`,
      status: 'EXECUTED',
      decisionMadeBy: 'USER',
    });

    return reply.status(200).send({ success: true, ...payload, dispatchedToRelay: true });
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

  // Companion WebSocket Relay Endpoint (Local mDNS + Cloud Relay + Edge Extension)
  const RELAYABLE_TYPES = new Set([
    'EDGE_ACTION',
    'EDGE_RESULT',
    'EDGE_OPEN_NEW_TAB',
    'BROWSER_ACTION',
    'BROWSER_ACTION_RESULT',
    'OPEN_WEBSITE',
    'WHATSAPP_CALL',
    'WHATSAPP_SEARCH_DOCUMENT',
    'WHATSAPP_DOCUMENT_FOUND',
    'WHATSAPP_DOCUMENT_READY',
    'EXECUTE_DESKTOP_APP',
    'INSTALLED_APPS_SYNC',
  ]);

  const handleRelayWebSocket = (connection: any, _req: any) => {
    const ws = connection?.socket || connection;
    relayService.registerSocket(ws);

    ws.on('message', (message: any) => {
      try {
        const text = typeof message === 'string' ? message : message.toString();
        const data = JSON.parse(text);
        if (data.type === 'HEARTBEAT') {
          ws.send(JSON.stringify({ type: 'HEARTBEAT_ACK', timestamp: new Date().toISOString() }));
        } else if (data.type === 'REGISTER') {
          const deviceType = data.deviceType || data.payload?.deviceType;
          const deviceId = data.deviceId || data.payload?.deviceId;
          if (deviceType) {
            relayService.updateSocketMeta(ws, {
              deviceId,
              deviceType,
            });
          }
          if (Array.isArray(data.installedApps)) {
            for (const item of data.installedApps) {
              if (!item?.appName || !item?.executablePath) continue;
              const id = `app-${String(item.appName).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
              const existing = db.installedApps.get(id);
              db.installedApps.set(id, {
                id,
                appName: item.appName,
                executablePath: item.executablePath,
                launchArgs: [],
                source: item.source === 'appx' ? 'APPX' : item.source === 'utility' ? 'SYSTEM_UTILITY' : 'START_MENU',
                trusted: existing?.trusted ?? false,
                autoApprove: existing?.autoApprove ?? false,
                icon: item.icon || 'app-window',
              });
            }
          }
          ws.send(JSON.stringify({ type: 'REGISTER_ACK', timestamp: new Date().toISOString() }));
        } else if (data.type && RELAYABLE_TYPES.has(data.type)) {
          relayService.broadcastExcept(ws, {
            id: data.id || crypto.randomUUID(),
            type: data.type,
            targetDeviceType: data.targetDeviceType,
            targetDeviceId: data.targetDeviceId,
            payload: data.payload || data,
            timestamp: data.timestamp || new Date().toISOString(),
          });
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
        connectedClients: relayService.getActiveSocketCount(),
        timestamp: new Date().toISOString(),
      })
    );
  };

  fastify.get('/api/devices/relay/ws', { websocket: true }, handleRelayWebSocket);
  fastify.get('/api/v1/devices/relay/ws', { websocket: true }, handleRelayWebSocket);
}
