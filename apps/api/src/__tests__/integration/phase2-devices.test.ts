import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { WebSocket as WsClient } from 'ws';
import { buildServer } from '../../server.js';
import { db } from '../../db/index.js';

describe('DON API Phase 2 Device, Edge, Trusted Fast-Launch & WhatsApp Routes', () => {
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

  it('GET and POST /api/devices/installed-apps lists and syncs installed apps', async () => {
    const listRes = await app.inject({ method: 'GET', url: '/api/devices/installed-apps' });
    expect(listRes.statusCode).toBe(200);
    const apps = JSON.parse(listRes.body);
    expect(apps.some((a: any) => a.appName === 'Microsoft Edge')).toBe(true);

    const syncRes = await app.inject({
      method: 'POST',
      url: '/api/devices/installed-apps',
      payload: {
        apps: [
          { appName: 'Obsidian', executablePath: 'C:\\Users\\User\\AppData\\Local\\Obsidian\\Obsidian.exe', source: 'START_MENU' },
        ],
      },
    });
    expect(syncRes.statusCode).toBe(200);
    const synced = JSON.parse(syncRes.body);
    expect(synced.some((a: any) => a.appName === 'Obsidian')).toBe(true);
  });

  it('POST /api/devices/trusted-policy + /api/chat records AUTO_APPROVED_TRUSTED audit log', async () => {
    const policyRes = await app.inject({
      method: 'POST',
      url: '/api/devices/trusted-policy',
      payload: {
        enabled: true,
        mode: 'TRUSTED_FAST_LAUNCH',
        trustedAppNames: ['Calculator'],
      },
    });
    expect(policyRes.statusCode).toBe(200);
    const policy = JSON.parse(policyRes.body);
    expect(policy.enabled).toBe(true);

    const chatRes = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { message: 'Open calculator app on desktop' },
    });
    expect(chatRes.statusCode).toBe(200);
    const chatJson = JSON.parse(chatRes.body);
    expect(chatJson.toolProposals[0].requiresApproval).toBe(false);
    expect(chatJson.toolProposals[0].status).toBe('APPROVED');

    // Verify AUTO_APPROVED_TRUSTED audit log entry
    expect(
      db.auditLogs.some((l) => l.status === 'AUTO_APPROVED_TRUSTED' && l.targetResource === 'Calculator')
    ).toBe(true);
  });

  it('POST /api/devices/open-website validates URLs and enforces Edge new-tab', async () => {
    const okRes = await app.inject({
      method: 'POST',
      url: '/api/devices/open-website',
      payload: { url: 'github.com/trending' },
    });
    expect(okRes.statusCode).toBe(200);
    const okJson = JSON.parse(okRes.body);
    expect(okJson.browser).toBe('msedge');
    expect(okJson.url).toBe('https://github.com/trending');
    expect(okJson.newTab).toBe(true);

    const badRes = await app.inject({
      method: 'POST',
      url: '/api/devices/open-website',
      payload: { url: 'javascript:alert(1)' },
    });
    expect(badRes.statusCode).toBe(400);
  });

  it('POST /api/whatsapp/search-document finds matching local documents and logs audit', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'don-api-wa-'));
    try {
      fs.writeFileSync(path.join(tempDir, 'Semester_Syllabus.pdf'), '%PDF-1.4');
      const res = await app.inject({
        method: 'POST',
        url: '/api/whatsapp/search-document',
        payload: { query: 'syllabus', searchDirs: [tempDir] },
      });
      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.matches.length).toBe(1);
      expect(json.matches[0].name).toBe('Semester_Syllabus.pdf');
      expect(db.auditLogs.some((l) => l.toolName === 'whatsapp_search_download_open')).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('POST /api/whatsapp/call validates target and dispatches whatsapp:// call', async () => {
    const missingRes = await app.inject({
      method: 'POST',
      url: '/api/whatsapp/call',
      payload: {},
    });
    expect(missingRes.statusCode).toBe(400);

    const okRes = await app.inject({
      method: 'POST',
      url: '/api/whatsapp/call',
      payload: { contactName: 'Mom', phoneNumber: '+15551234567', callType: 'VOICE' },
    });
    expect(okRes.statusCode).toBe(200);
    const json = JSON.parse(okRes.body);
    expect(json.success).toBe(true);
    expect(json.protocolUri).toBe('whatsapp://call?phone=%2B15551234567');
    expect(db.auditLogs.some((l) => l.toolName === 'whatsapp_call')).toBe(true);
  });

  it('Relay WebSocket forwards messages between Edge extension and Desktop Agent', async () => {
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const wsUrl = address.replace('http', 'ws') + '/api/devices/relay/ws';

    const edgeClient = new WsClient(wsUrl);
    const desktopClient = new WsClient(wsUrl);

    await Promise.all([
      new Promise<void>((resolve) => edgeClient.once('open', () => resolve())),
      new Promise<void>((resolve) => desktopClient.once('open', () => resolve())),
    ]);

    edgeClient.send(JSON.stringify({ type: 'REGISTER', deviceType: 'BROWSER_EXTENSION' }));
    desktopClient.send(JSON.stringify({ type: 'REGISTER', deviceType: 'DESKTOP_AGENT' }));

    const forwardedPromise = new Promise<any>((resolve) => {
      desktopClient.on('message', (raw) => {
        const parsed = JSON.parse(raw.toString());
        if (parsed.type === 'WHATSAPP_DOCUMENT_FOUND') {
          resolve(parsed);
        }
      });
    });

    // Small delay to ensure REGISTER is processed before forwarding
    await new Promise((r) => setTimeout(r, 50));
    edgeClient.send(
      JSON.stringify({
        type: 'WHATSAPP_DOCUMENT_FOUND',
        targetDeviceType: 'DESKTOP_AGENT',
        payload: { fileName: 'CS101_Syllabus.pdf' },
      })
    );

    const forwarded = await forwardedPromise;
    expect(forwarded.type).toBe('WHATSAPP_DOCUMENT_FOUND');
    expect(forwarded.payload.fileName).toBe('CS101_Syllabus.pdf');

    edgeClient.close();
    desktopClient.close();
  });

  it('supports web HUD & extension payload aliases and /api/whatsapp/document-downloaded', async () => {
    // trustedFastLaunch & appId/trusted aliases
    const toggleRes = await app.inject({
      method: 'POST',
      url: '/api/devices/trusted-policy',
      payload: { trustedFastLaunch: true, appId: 'app-calc', trusted: true },
    });
    expect(toggleRes.statusCode).toBe(200);
    const toggleJson = JSON.parse(toggleRes.body);
    expect(toggleJson.trustedFastLaunch).toBe(true);
    expect(toggleJson.enabled).toBe(true);

    const getPolicyRes = await app.inject({ method: 'GET', url: '/api/devices/trusted-policy' });
    const getPolicyJson = JSON.parse(getPolicyRes.body);
    expect(getPolicyJson.trustedFastLaunch).toBe(true);
    expect(typeof getPolicyJson.edgeBridgeConnected).toBe('boolean');

    // keyword alias on /api/whatsapp/search-document
    const searchRes = await app.inject({
      method: 'POST',
      url: '/api/whatsapp/search-document',
      payload: { keyword: 'syllabus', searchDirs: [os.tmpdir()] },
    });
    expect(searchRes.statusCode).toBe(200);

    // contact alias on /api/whatsapp/call
    const callRes = await app.inject({
      method: 'POST',
      url: '/api/whatsapp/call',
      payload: { contact: 'Dad' },
    });
    expect(callRes.statusCode).toBe(200);
    expect(JSON.parse(callRes.body).contactName).toBe('Dad');

    // /api/whatsapp/document-downloaded
    const dlRes = await app.inject({
      method: 'POST',
      url: '/api/whatsapp/document-downloaded',
      payload: { fileName: 'CS101_Syllabus.pdf', keyword: 'syllabus' },
    });
    expect(dlRes.statusCode).toBe(200);
    expect(JSON.parse(dlRes.body).success).toBe(true);
  });
});
