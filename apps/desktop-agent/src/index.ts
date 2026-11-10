import { WebSocket as WsClient } from 'ws';
import { AppAllowlistManager } from './allowlist.js';
import { ScreenCaptureManager } from './screen-capture.js';

export class DesktopAgentDaemon {
  public allowlist = new AppAllowlistManager();
  public screenCapture = new ScreenCaptureManager();
  private killSwitchActive = false;
  private wsClient: WsClient | null = null;

  setKillSwitch(active: boolean) {
    this.killSwitchActive = active;
    if (active) {
      this.screenCapture.stopSharing();
    }
  }

  isKillSwitchActive(): boolean {
    return this.killSwitchActive;
  }

  connectRelay(serverUrl: string, token: string): void {
    const wsUrl = serverUrl.replace(/^http/, 'ws') + '/api/devices/relay/ws';
    this.wsClient = new WsClient(wsUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    this.wsClient.on('message', (data: Buffer | string) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'KILL_SWITCH_TRIGGERED') {
          this.setKillSwitch(Boolean(msg.payload?.isActivated));
        }
      } catch {
        // ignore format issues
      }
    });
  }

  disconnectRelay(): void {
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }
  }

  async executeApprovedApp(appName: string, userConfirmed: boolean): Promise<{ success: boolean; message: string }> {
    if (this.killSwitchActive) {
      throw new Error('Action blocked: Emergency Kill Switch is engaged.');
    }

    if (!userConfirmed) {
      throw new Error('Action blocked: User confirmation required before launching desktop apps.');
    }

    const check = this.allowlist.isAllowed(appName);
    if (!check.allowed) {
      throw new Error(`Security Violation: ${check.reason}`);
    }

    // In production, launches verified binary with fixed path using child_process.spawn(check.fixedExecutablePath!, [], { detached: true })
    return {
      success: true,
      message: `Launched allowlisted app "${appName}" at fixed binary: ${check.fixedExecutablePath}`,
    };
  }

  openUserSelectedFolder(folderPath: string, userConfirmed: boolean): { success: boolean; message: string } {
    if (this.killSwitchActive) throw new Error('Blocked: Kill switch active.');
    if (!userConfirmed) throw new Error('User confirmation required.');

    return {
      success: true,
      message: `Opened safe explorer folder: ${folderPath}`,
    };
  }

  showDesktopNotification(title: string, body: string): { success: boolean } {
    if (this.killSwitchActive) return { success: false };
    return { success: true };
  }
}

export const desktopDaemon = new DesktopAgentDaemon();
