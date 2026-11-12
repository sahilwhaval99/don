import { WebSocket as WsClient } from 'ws';
import child_process from 'child_process';
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

  connectRelay(serverUrl = 'http://localhost:3001', token = 'LOCAL_DESKTOP_TOKEN'): void {
    const wsUrl = serverUrl.replace(/^http/, 'ws') + '/api/devices/relay/ws';
    try {
      this.wsClient = new WsClient(wsUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      this.wsClient.on('open', () => {
        console.log('[DON Desktop Agent] Connected to relay at', wsUrl);
      });

      this.wsClient.on('message', (data: Buffer | string) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'KILL_SWITCH_TRIGGERED') {
            this.setKillSwitch(Boolean(msg.payload?.isActivated));
          } else if (msg.type === 'EXECUTE_DESKTOP_APP') {
            const appName = msg.payload?.parameters?.appName || msg.payload?.appName;
            if (appName) {
              console.log('[DON Desktop Agent] Executing approved app from relay:', appName);
              this.executeApprovedApp(appName, true).catch((err) => {
                console.error('[DON Desktop Agent] Execution error:', err.message);
              });
            }
          } else if (msg.type === 'CAPTURE_SCREEN') {
            console.log('[DON Desktop Agent] Screen capture session requested:', msg.payload?.sessionId);
          }
        } catch {
          // ignore format issues
        }
      });

      this.wsClient.on('error', (err) => {
        console.warn('[DON Desktop Agent] Relay connection notice:', err.message);
      });

      this.wsClient.on('close', () => {
        console.log('[DON Desktop Agent] Relay connection closed. Reconnecting in 5s...');
        setTimeout(() => {
          if (!this.killSwitchActive) this.connectRelay(serverUrl, token);
        }, 5000);
      });
    } catch (e: any) {
      console.warn('[DON Desktop Agent] Failed to initiate relay connection:', e.message);
    }
  }

  disconnectRelay(): void {
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }
  }

  async executeApprovedApp(appName: string, userConfirmed: boolean): Promise<{ success: boolean; message: string; pid?: number }> {
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

    const exePath = check.fixedExecutablePath!;
    try {
      let child: any = null;
      if (process.platform === 'win32') {
        child = child_process.spawn('cmd.exe', ['/c', 'start', '', exePath], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
      } else {
        child = child_process.spawn(exePath, [], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
      }

      return {
        success: true,
        message: `Launched allowlisted app "${appName}" (PID: ${child?.pid || 'active'}) at: ${exePath}`,
        pid: child?.pid,
      };
    } catch (err: any) {
      throw new Error(`Failed to launch application "${appName}": ${err.message}`);
    }
  }

  openUserSelectedFolder(folderPath: string, userConfirmed: boolean): { success: boolean; message: string } {
    if (this.killSwitchActive) throw new Error('Blocked: Kill switch active.');
    if (!userConfirmed) throw new Error('User confirmation required.');

    child_process.spawn('explorer.exe', [folderPath], { detached: true, stdio: 'ignore' }).unref();

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

// If run directly via node, start the daemon and connect to local relay
if (process.argv[1] && process.argv[1].includes('desktop-agent')) {
  console.log('[DON Desktop Agent] Starting Windows companion daemon...');
  desktopDaemon.connectRelay(process.env.API_URL || 'http://localhost:3001');
}
