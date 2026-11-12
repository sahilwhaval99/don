import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  DesktopAgentDaemon,
  scanInstalledApps,
  buildWhatsAppProtocolUri,
  searchLocalDocuments,
} from '../index.js';

describe('Desktop Agent Phase 2 Capabilities', () => {
  let daemon: DesktopAgentDaemon;
  let tempDir: string;

  beforeEach(() => {
    daemon = new DesktopAgentDaemon();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'don-desktop-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('scans Start Menu .lnk shortcuts and provides deterministic mock fallback', () => {
    const startMenuSub = path.join(tempDir, 'StartMenu', 'Programs', 'Dev');
    fs.mkdirSync(startMenuSub, { recursive: true });
    fs.writeFileSync(path.join(startMenuSub, 'CustomTool.lnk'), '');
    fs.writeFileSync(path.join(startMenuSub, 'Uninstall CustomTool.lnk'), '');

    const scanned = scanInstalledApps({ startMenuDirs: [path.join(tempDir, 'StartMenu', 'Programs')], skipAppxQuery: true });
    expect(scanned.some((a) => a.appName === 'CustomTool')).toBe(true);
    expect(scanned.some((a) => a.appName.toLowerCase().includes('uninstall'))).toBe(false);

    const mockApps = scanInstalledApps({ forceMock: true });
    const names = mockApps.map((a) => a.appName.toLowerCase());
    expect(names).toContain('calculator');
    expect(names).toContain('microsoft edge');
    expect(names).toContain('whatsapp');
    expect(names).toContain('spotify');
    expect(names).toContain('discord');
  });

  it('enforces Microsoft Edge exclusivity (--new-tab) and blocks unsafe protocols', () => {
    const res = daemon.openUrlInEdge('github.com/trending', true);
    expect(res.success).toBe(true);
    expect(res.browser).toBe('msedge');
    expect(res.args).toEqual(['--new-tab', 'https://github.com/trending']);

    expect(() => daemon.openUrlInEdge('javascript:alert(1)', true)).toThrow(/Only http\/https/i);
    expect(() => daemon.openUrlInEdge('file:///C:/Windows/win.ini', true)).toThrow(/Only http\/https/i);

    daemon.setKillSwitch(true);
    expect(() => daemon.openUrlInEdge('https://example.com', true)).toThrow(/Kill Switch/i);
  });

  it('supports Trusted Fast-Launch with strict Trusted Registry path validation', async () => {
    daemon.scanAndRegisterApps({ forceMock: true });

    // Without user confirmation and with Trusted Fast-Launch disabled, execution is blocked
    await expect(daemon.executeApprovedApp('Calculator', false)).rejects.toThrow(/User confirmation required/i);

    // Enable global Trusted Fast-Launch and mark Calculator as trusted
    daemon.allowlist.setGlobalTrustedFastLaunch(true);
    daemon.allowlist.setTrusted('Calculator', true);

    const launchRes = await daemon.executeApprovedApp('Calculator', false);
    expect(launchRes.success).toBe(true);
    expect(launchRes.autoApprovedTrusted).toBe(true);

    // Untrusted app still requires user confirmation
    await expect(daemon.executeApprovedApp('Spotify', false)).rejects.toThrow(/User confirmation required/i);

    // Reject path tampering / shell RCE even when Trusted Fast-Launch is enabled
    await expect(
      daemon.executeApprovedApp('Calculator', false, { requestedPath: 'C:\\Windows\\System32\\cmd.exe /c whoami' })
    ).rejects.toThrow(/User confirmation required|Security/i);

    expect(() => daemon.allowlist.registerApp('Evil', 'C:\\Windows\\System32\\cmd.exe;whoami')).toThrow(/Security violation/i);
  });

  it('builds and launches whatsapp:// protocol URIs safely', () => {
    const callUri = buildWhatsAppProtocolUri({ action: 'call', phoneNumber: '+1 (555) 123-4567' });
    expect(callUri).toBe('whatsapp://call?phone=%2B15551234567');

    const chatUri = buildWhatsAppProtocolUri({ action: 'chat', phoneNumber: '+15551234567', message: 'Hi Mom' });
    expect(chatUri).toBe('whatsapp://send?phone=%2B15551234567&text=Hi%20Mom');

    const launchRes = daemon.openWhatsApp({ action: 'call', phoneNumber: '+15551234567' });
    expect(launchRes.success).toBe(true);
    expect(launchRes.uri).toBe('whatsapp://call?phone=%2B15551234567');
  });

  it('searches authorized Downloads/WhatsApp folders and opens documents in Edge or default viewer', () => {
    const waFolder = path.join(tempDir, 'WhatsApp');
    fs.mkdirSync(waFolder, { recursive: true });
    const pdfPath = path.join(waFolder, 'CS101_Syllabus.pdf');
    const docxPath = path.join(waFolder, 'Project_Notes.docx');
    fs.writeFileSync(pdfPath, '%PDF-1.4 mock');
    fs.writeFileSync(docxPath, 'mock docx');

    const matches = searchLocalDocuments('syllabus', [waFolder]);
    expect(matches.length).toBe(1);
    expect(matches[0].name).toBe('CS101_Syllabus.pdf');

    const openPdf = daemon.openDocument(pdfPath, { authorizedDirs: [waFolder] });
    expect(openPdf.success).toBe(true);
    expect(openPdf.viewer).toBe('msedge');

    const openDocx = daemon.openDocument(docxPath, { authorizedDirs: [waFolder] });
    expect(openDocx.success).toBe(true);
    expect(openDocx.viewer).toBe('default');

    // Reject opening files outside authorized directories
    const outsideFile = path.join(os.tmpdir(), 'secret.txt');
    expect(() => daemon.openDocument(outsideFile, { authorizedDirs: [waFolder] })).toThrow(/outside authorized/i);
  });
});
