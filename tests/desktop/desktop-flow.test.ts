import { describe, it, expect, beforeEach } from 'vitest';
import { DesktopAgentDaemon } from '../../apps/desktop-agent/src/index.js';
import { db } from '../../apps/api/src/db/index.js';
import { relayService } from '../../apps/api/src/services/relay.service.js';

describe('Round 9: Desktop Mock Test Suite (Pairing, Allowlist, Approvals, Screen Capture, Kill Switch)', () => {
  let daemon: DesktopAgentDaemon;

  beforeEach(() => {
    db.reset();
    daemon = new DesktopAgentDaemon();
  });

  it('pairs desktop companion device using one-time pairing token', () => {
    const owner = Array.from(db.users.values())[0];
    const pairingToken = relayService.generatePairingToken(owner.id, 'DESKTOP_AGENT');
    expect(pairingToken.token).toBeTruthy();

    const paired = relayService.pairDevice(pairingToken.token, 'Primary Windows Workstation');
    expect(paired.name).toBe('Primary Windows Workstation');
    expect(paired.deviceType).toBe('DESKTOP_AGENT');
    expect(paired.status).toBe('PAIRED');
  });

  it('enforces app allowlist and blocks unapproved/arbitrary executable attempts', async () => {
    // 1. Authorized app without user confirmation -> BLOCKED
    await expect(daemon.executeApprovedApp('Calculator', false)).rejects.toThrow(
      'User confirmation required before launching desktop apps'
    );

    // 2. Authorized app with user confirmation -> ALLOWED
    const approvedRes = await daemon.executeApprovedApp('Calculator', true);
    expect(approvedRes.success).toBe(true);
    expect(approvedRes.message).toContain('Launched allowlisted app "Calculator"');

    // 3. Unauthorized binary (e.g. powershell or arbitrary malware) -> STRICTLY BLOCKED
    await expect(daemon.executeApprovedApp('powershell.exe', true)).rejects.toThrow(
      'Security Violation'
    );

    // 4. Spoofed path mismatch attempt -> STRICTLY BLOCKED
    const checkMismatch = daemon.allowlist.isAllowed('Calculator', 'C:\\malware\\calc.exe');
    expect(checkMismatch.allowed).toBe(false);
    expect(checkMismatch.reason).toContain('Path mismatch');
  });

  it('manages safe folder navigation with explicit user confirmation', () => {
    expect(() => daemon.openUserSelectedFolder('C:\\Work\\Project', false)).toThrow(
      'User confirmation required'
    );

    const res = daemon.openUserSelectedFolder('C:\\Work\\Project', true);
    expect(res.success).toBe(true);
    expect(res.message).toContain('Opened safe explorer folder');
  });

  it('manages transient screen capture sessions with immediate wipe on stop', () => {
    // Denied without user consent
    expect(() => daemon.screenCapture.requestSession('VS Code', false)).toThrow(
      'Screen capture permission was explicitly denied'
    );

    // Allowed with user consent
    const session = daemon.screenCapture.requestSession('VS Code', true);
    expect(session.active).toBe(true);
    expect(daemon.screenCapture.getActiveSession()).not.toBeNull();

    // Terminated and purged
    const stopRes = daemon.screenCapture.stopSharing();
    expect(stopRes.success).toBe(true);
    expect(daemon.screenCapture.getActiveSession()).toBeNull();
  });

  it('engages emergency kill switch and severs all desktop actions and active captures', async () => {
    daemon.screenCapture.requestSession('Workspace', true);
    expect(daemon.screenCapture.getActiveSession()).not.toBeNull();

    // Engage kill switch
    daemon.setKillSwitch(true);
    expect(daemon.isKillSwitchActive()).toBe(true);

    // Screen sharing session should be immediately purged
    expect(daemon.screenCapture.getActiveSession()).toBeNull();

    // Any subsequent app launch attempt should be blocked
    await expect(daemon.executeApprovedApp('Calculator', true)).rejects.toThrow(
      'Emergency Kill Switch is engaged'
    );

    // Folder navigation blocked
    expect(() => daemon.openUserSelectedFolder('C:\\Work', true)).toThrow(
      'Blocked: Kill switch active'
    );

    // Notifications suppressed
    expect(daemon.showDesktopNotification('Alert', 'Test').success).toBe(false);
  });
});
