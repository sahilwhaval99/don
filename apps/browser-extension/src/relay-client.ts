export interface RelayEnvelope {
  id?: string;
  type: string;
  targetDeviceId?: string;
  targetDeviceType?: string;
  payload?: Record<string, unknown>;
  timestamp?: string;
  killSwitchActive?: boolean;
}

export interface RelayClientOptions {
  url?: string;
  heartbeatIntervalMs?: number;
  baseReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  WebSocketImpl?: typeof WebSocket;
  onMessage?: (message: RelayEnvelope) => void | Promise<void>;
  onStatusChange?: (status: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED') => void;
}

export class RelayWebSocketClient {
  private readonly url: string;
  private readonly heartbeatIntervalMs: number;
  private readonly baseReconnectDelayMs: number;
  private readonly maxReconnectDelayMs: number;
  private readonly WebSocketImpl: typeof WebSocket | undefined;
  private readonly onMessage?: (message: RelayEnvelope) => void | Promise<void>;
  private readonly onStatusChange?: (status: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED') => void;

  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private manuallyClosed = false;
  private status: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' = 'DISCONNECTED';

  constructor(options: RelayClientOptions = {}) {
    this.url = options.url ?? 'ws://localhost:3001/api/devices/relay/ws';
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 25_000;
    this.baseReconnectDelayMs = options.baseReconnectDelayMs ?? 1_000;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs ?? 30_000;
    this.WebSocketImpl =
      options.WebSocketImpl ?? (typeof WebSocket !== 'undefined' ? WebSocket : undefined);
    this.onMessage = options.onMessage;
    this.onStatusChange = options.onStatusChange;
  }

  getStatus(): 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' {
    return this.status;
  }

  connect(): void {
    if (!this.WebSocketImpl) {
      return;
    }
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) {
      return;
    }

    this.manuallyClosed = false;
    this.setStatus('CONNECTING');

    const socket = new this.WebSocketImpl(this.url);
    this.ws = socket;

    socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.setStatus('CONNECTED');
      this.send({
        type: 'REGISTER',
        payload: {
          deviceType: 'BROWSER_EXTENSION',
          browser: 'edge',
        },
        timestamp: new Date().toISOString(),
      });
      this.sendHeartbeat();
      this.startHeartbeat();
    };

    socket.onmessage = (event: MessageEvent) => {
      try {
        const raw = typeof event.data === 'string' ? event.data : String(event.data);
        const parsed = JSON.parse(raw) as RelayEnvelope;
        if (this.onMessage) {
          void this.onMessage(parsed);
        }
      } catch {
        // Ignore malformed JSON frames
      }
    };

    socket.onclose = () => {
      this.stopHeartbeat();
      this.ws = null;
      this.setStatus('DISCONNECTED');
      if (!this.manuallyClosed) {
        this.scheduleReconnect();
      }
    };

    socket.onerror = () => {
      // onclose will handle cleanup and reconnect scheduling
    };
  }

  disconnect(): void {
    this.manuallyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore close errors
      }
      this.ws = null;
    }
    this.setStatus('DISCONNECTED');
  }

  send(payload: Record<string, unknown>): boolean {
    if (!this.ws || this.ws.readyState !== 1) {
      return false;
    }
    try {
      this.ws.send(JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  sendHeartbeat(): boolean {
    return this.send({
      type: 'HEARTBEAT',
      source: 'EDGE_EXTENSION',
      timestamp: new Date().toISOString(),
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    const delay = Math.min(
      this.maxReconnectDelayMs,
      this.baseReconnectDelayMs * Math.pow(2, this.reconnectAttempt)
    );
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private setStatus(next: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED'): void {
    this.status = next;
    this.onStatusChange?.(next);
  }
}
