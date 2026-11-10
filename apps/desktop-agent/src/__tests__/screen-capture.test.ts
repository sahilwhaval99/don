import { describe, it, expect, beforeEach } from 'vitest';
import { ScreenCaptureManager } from '../screen-capture.js';

describe('ScreenCaptureManager', () => {
  let captureManager: ScreenCaptureManager;

  beforeEach(() => {
    captureManager = new ScreenCaptureManager();
  });

  it('rejects capture if user explicit consent is false', () => {
    expect(() => {
      captureManager.requestSession('Window 1', false);
    }).toThrow('Screen capture permission was explicitly denied by user.');
  });

  it('creates active session with transient buffer when consent is granted', () => {
    const session = captureManager.requestSession('Active Workspace', true);
    expect(session.active).toBe(true);
    expect(session.sessionId).toBeTruthy();
    expect(session.transientBuffer).not.toBeNull();
  });

  it('immediately purges transient buffer and clears session on stopSharing()', () => {
    captureManager.requestSession('Active Workspace', true);
    const stopResult = captureManager.stopSharing();
    expect(stopResult.success).toBe(true);
    expect(stopResult.message).toContain('Transient capture buffers wiped from memory');
    expect(captureManager.getActiveSession()).toBeNull();
  });
});
