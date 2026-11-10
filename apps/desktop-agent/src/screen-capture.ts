import crypto from 'crypto';

export interface ScreenSharingSession {
  sessionId: string;
  active: boolean;
  windowTarget: string;
  grantedAt: string;
  transientBuffer: Buffer | null;
}

export class ScreenCaptureManager {
  private activeSession: ScreenSharingSession | null = null;

  requestSession(windowTarget = 'Active Workspace Window', userGrantedConsent: boolean): ScreenSharingSession {
    if (!userGrantedConsent) {
      throw new Error('Screen capture permission was explicitly denied by user.');
    }

    this.activeSession = {
      sessionId: crypto.randomUUID(),
      active: true,
      windowTarget,
      grantedAt: new Date().toISOString(),
      transientBuffer: Buffer.from('TRANSIENT_SCREENSHOT_DATA_BUFFER_RAW_PNG'),
    };

    return this.activeSession;
  }

  getActiveSession(): ScreenSharingSession | null {
    return this.activeSession;
  }

  stopSharing(): { success: boolean; message: string } {
    if (this.activeSession) {
      // Purge transient buffer immediately to respect zero-retention policy
      this.activeSession.transientBuffer = null;
      this.activeSession.active = false;
      this.activeSession = null;
    }
    return {
      success: true,
      message: 'Screen sharing terminated. Transient capture buffers wiped from memory.',
    };
  }
}
