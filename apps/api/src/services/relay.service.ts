import { EventEmitter } from 'events';
import crypto from 'crypto';
import type { WebSocket as WsWebSocket } from 'ws';
import { Device, DeviceType, PairingToken } from '@don/shared';
import { db } from '../db/index.js';

export interface RelayMessage {
  id: string;
  type:
    | 'APPROVAL_REQUEST'
    | 'APPROVAL_DECISION'
    | 'EXECUTE_DESKTOP_APP'
    | 'CAPTURE_SCREEN'
    | 'KILL_SWITCH_TRIGGERED'
    | 'HEARTBEAT'
    | 'TASK_REMINDER';
  targetDeviceId?: string;
  targetDeviceType?: DeviceType;
  payload: Record<string, unknown>;
  timestamp: string;
}

export class DeviceRelayService extends EventEmitter {
  private activeConnections: Map<string, { deviceId: string; deviceType: DeviceType; lastSeen: Date }> = new Map();
  private pairingTokens: Map<string, { userId: string; deviceType: DeviceType; expiresAt: Date }> = new Map();
  private activeSockets: Set<WsWebSocket> = new Set();

  registerSocket(ws: WsWebSocket, meta?: { deviceId?: string; deviceType?: DeviceType }) {
    this.activeSockets.add(ws);
    ws.on('close', () => {
      this.activeSockets.delete(ws);
    });
  }

  unregisterSocket(ws: WsWebSocket) {
    this.activeSockets.delete(ws);
  }

  getActiveSocketCount(): number {
    return this.activeSockets.size;
  }

  generatePairingToken(userId: string, deviceType: DeviceType): PairingToken {
    const token = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 char hex
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    this.pairingTokens.set(token, { userId, deviceType, expiresAt });

    const qrPayload = JSON.stringify({
      protocol: 'don-pair-v1',
      token,
      deviceType,
      relayEndpoint: process.env.API_URL || 'http://localhost:3001',
      expiresAt: expiresAt.toISOString(),
    });

    return {
      token,
      deviceType,
      expiresAt: expiresAt.toISOString(),
      qrPayload,
    };
  }

  pairDevice(token: string, deviceName: string, publicKey?: string): Device {
    const record = this.pairingTokens.get(token);
    if (!record || new Date() > record.expiresAt) {
      throw new Error('Invalid or expired pairing token.');
    }

    const deviceId = crypto.randomUUID();
    const newDevice: Device = {
      id: deviceId,
      userId: record.userId,
      name: deviceName,
      deviceType: record.deviceType,
      status: 'PAIRED',
      publicKey,
      lastSeenAt: new Date().toISOString(),
      ipAddress: '127.0.0.1',
      clientVersion: '1.0.0',
      capabilities: record.deviceType === 'DESKTOP_AGENT'
        ? ['ALLOWLISTED_APP_LAUNCH', 'TRANSIENT_SCREEN_CAPTURE', 'DESKTOP_NOTIFICATION']
        : ['PUSH_APPROVAL', 'DIALER_INTENT', 'DIRECT_CALL_CONSENT'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.devices.set(deviceId, newDevice);
    this.pairingTokens.delete(token);
    return newDevice;
  }

  broadcast(message: RelayMessage) {
    this.emit('message', message);
    const data = JSON.stringify(message);
    for (const ws of this.activeSockets) {
      if (ws.readyState === 1) {
        try {
          ws.send(data);
        } catch {
          // ignore closed socket send
        }
      }
    }
  }

  notifyKillSwitch(isActivated: boolean) {
    this.broadcast({
      id: crypto.randomUUID(),
      type: 'KILL_SWITCH_TRIGGERED',
      payload: { isActivated },
      timestamp: new Date().toISOString(),
    });
  }
}

export const relayService = new DeviceRelayService();
