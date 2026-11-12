import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserCompanionService, BrowserActionRequest } from '../background.js';
import { RelayWebSocketClient } from '../relay-client.js';
import { handleContentMessage } from '../content.js';
import { WhatsAppWebBridge } from '../whatsapp-content.js';

describe('BrowserCompanionService (Manifest V3 Edge Companion)', () => {
  let service: BrowserCompanionService;
  let mockTabsCreate: ReturnType<typeof vi.fn>;
  let mockTabsQuery: ReturnType<typeof vi.fn>;
  let mockTabsUpdate: ReturnType<typeof vi.fn>;
  let mockTabsSendMessage: ReturnType<typeof vi.fn>;
  let mockWindowsUpdate: ReturnType<typeof vi.fn>;
  let mockPermissionsContains: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new BrowserCompanionService();
    mockTabsCreate = vi.fn().mockResolvedValue({ id: 101, url: 'https://example.com' });
    mockTabsQuery = vi.fn().mockResolvedValue([
      { id: 101, active: true, title: 'Example Domain', url: 'https://example.com', windowId: 1 },
    ]);
    mockTabsUpdate = vi.fn().mockResolvedValue({ id: 101 });
    mockTabsSendMessage = vi.fn().mockResolvedValue({ state: 'PLAYING' });
    mockWindowsUpdate = vi.fn().mockResolvedValue({ id: 1, focused: true });
    mockPermissionsContains = vi.fn().mockResolvedValue(true);

    (globalThis as any).chrome = {
      tabs: {
        create: mockTabsCreate,
        query: mockTabsQuery,
        update: mockTabsUpdate,
        sendMessage: mockTabsSendMessage,
      },
      windows: {
        update: mockWindowsUpdate,
      },
      permissions: {
        contains: mockPermissionsContains,
      },
      storage: {
        local: {
          set: vi.fn().mockResolvedValue(undefined),
          get: vi.fn(),
        },
      },
      runtime: {
        onMessage: {
          addListener: vi.fn(),
        },
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('strictly blocks actions when confirmedByUser is false', async () => {
    const req: BrowserActionRequest = {
      actionType: 'OPEN_TAB',
      targetUrl: 'https://example.com',
      confirmedByUser: false,
    };

    const res = await service.handleAction(req);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Explicit user confirmation required');
    expect(mockTabsCreate).not.toHaveBeenCalled();
  });

  it('creates approved browser tab when user confirms', async () => {
    const req: BrowserActionRequest = {
      actionType: 'OPEN_TAB',
      targetUrl: 'https://developer.mozilla.org',
      confirmedByUser: true,
    };

    const res = await service.handleAction(req);
    expect(res.success).toBe(true);
    expect(res.result).toContain('https://developer.mozilla.org');
    expect(mockTabsCreate).toHaveBeenCalledWith({ url: 'https://developer.mozilla.org/' });
  });

  it('opens new tab via OPEN_NEW_TAB, normalizes domain, and blocks unsafe protocols', async () => {
    const res = await service.handleAction({
      actionType: 'OPEN_NEW_TAB',
      targetUrl: 'github.com',
      confirmedByUser: true,
    });
    expect(res.success).toBe(true);
    expect(mockTabsCreate).toHaveBeenCalledWith({ url: 'https://github.com/' });

    const unsafe = await service.handleAction({
      actionType: 'OPEN_NEW_TAB',
      targetUrl: 'javascript:alert(1)',
      confirmedByUser: true,
    });
    expect(unsafe.success).toBe(false);
    expect(unsafe.error).toContain('Blocked unsafe URL protocol');
  });

  it('navigates active tab to approved URL upon user confirmation', async () => {
    const req: BrowserActionRequest = {
      actionType: 'NAVIGATE',
      targetUrl: 'https://github.com',
      confirmedByUser: true,
    };

    const res = await service.handleAction(req);
    expect(res.success).toBe(true);
    expect(res.result).toContain('Navigated current tab');
    expect(mockTabsUpdate).toHaveBeenCalledWith(101, { url: 'https://github.com/' });
  });

  it('lists open Edge tabs cleanly', async () => {
    mockTabsQuery.mockResolvedValueOnce([
      { id: 1, title: 'GitHub', url: 'https://github.com', active: false, windowId: 10, audible: false },
      { id: 2, title: 'YouTube', url: 'https://www.youtube.com/watch?v=1', active: true, windowId: 10, audible: true },
    ]);

    const res = await service.handleAction({
      actionType: 'LIST_OPEN_TABS',
      confirmedByUser: true,
    });

    expect(res.success).toBe(true);
    const data = res.data as { tabs: Array<{ id: number; title: string; audible: boolean }> };
    expect(data.tabs).toHaveLength(2);
    expect(data.tabs[1].title).toBe('YouTube');
    expect(data.tabs[1].audible).toBe(true);
  });

  it('switches to a matching tab by query and focuses its window', async () => {
    mockTabsQuery.mockResolvedValueOnce([
      { id: 11, title: 'GitHub', url: 'https://github.com', active: false, windowId: 5 },
      { id: 12, title: 'DON HUD', url: 'http://localhost:3000', active: true, windowId: 5 },
    ]);

    const res = await service.handleAction({
      actionType: 'SWITCH_TAB',
      query: 'github',
      confirmedByUser: true,
    });

    expect(res.success).toBe(true);
    expect(mockTabsUpdate).toHaveBeenCalledWith(11, { active: true });
    expect(mockWindowsUpdate).toHaveBeenCalledWith(5, { focused: true });
  });

  it('returns error when switch_tab finds no matching tab', async () => {
    mockTabsQuery.mockResolvedValueOnce([{ id: 12, title: 'DON HUD', url: 'http://localhost:3000' }]);

    const res = await service.handleAction({
      actionType: 'SWITCH_TAB',
      query: 'nonexistent',
      confirmedByUser: true,
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('No open tab matched query');
  });

  it('enforces explicit domain permission check in read_active_page_summary', async () => {
    mockPermissionsContains.mockResolvedValueOnce(false);

    const denied = await service.handleAction({
      actionType: 'READ_ACTIVE_PAGE_SUMMARY',
      confirmedByUser: true,
    });

    expect(denied.success).toBe(false);
    expect(denied.error).toContain('Explicit domain permission required');
    expect(mockTabsSendMessage).not.toHaveBeenCalled();

    mockPermissionsContains.mockResolvedValueOnce(true);
    mockTabsSendMessage.mockResolvedValueOnce({
      success: true,
      summary: {
        title: 'Example Domain',
        url: 'https://example.com',
        description: 'Demo page',
        headings: ['Example Domain'],
        textSnippet: 'This domain is for use in illustrative examples.',
      },
    });

    const allowed = await service.handleAction({
      actionType: 'READ_ACTIVE_PAGE_SUMMARY',
      confirmedByUser: true,
    });

    expect(allowed.success).toBe(true);
    expect(mockTabsSendMessage).toHaveBeenCalledWith(101, { command: 'READ_PAGE_SUMMARY' });
  });

  it('dispatches YouTube search in new tab', async () => {
    const req: BrowserActionRequest = {
      actionType: 'YOUTUBE_SEARCH',
      targetUrl: 'ambient focus music',
      confirmedByUser: true,
    };

    const res = await service.handleAction(req);
    expect(res.success).toBe(true);
    expect(mockTabsCreate).toHaveBeenCalledWith({
      url: 'https://www.youtube.com/results?search_query=ambient%20focus%20music',
    });
  });

  it('dispatches YouTube play/pause toggle when YouTube tab is present', async () => {
    mockTabsQuery.mockResolvedValueOnce([{ id: 202, url: 'https://www.youtube.com/watch?v=123' }]);

    const req: BrowserActionRequest = {
      actionType: 'YOUTUBE_PLAY_PAUSE',
      confirmedByUser: true,
    };

    const res = await service.handleAction(req);
    expect(res.success).toBe(true);
    expect(mockTabsSendMessage).toHaveBeenCalledWith(202, { command: 'TOGGLE_PLAYBACK' });
  });

  it('gracefully reports error when no YouTube tab is open', async () => {
    mockTabsQuery.mockResolvedValueOnce([]);

    const req: BrowserActionRequest = {
      actionType: 'YOUTUBE_PLAY_PAUSE',
      confirmedByUser: true,
    };

    const res = await service.handleAction(req);
    expect(res.success).toBe(false);
    expect(res.error).toContain('No YouTube tab is currently open');
  });

  it('handles media_control play, pause, and mute on active media tab', async () => {
    mockTabsQuery.mockResolvedValue([
      { id: 303, title: 'Lo-Fi Radio', url: 'https://www.youtube.com/watch?v=abc', active: true },
    ]);

    const playRes = await service.handleAction({
      actionType: 'MEDIA_CONTROL',
      mediaAction: 'play',
      confirmedByUser: true,
    });
    expect(playRes.success).toBe(true);
    expect(mockTabsSendMessage).toHaveBeenCalledWith(303, { command: 'MEDIA_CONTROL', action: 'play' });

    const muteRes = await service.handleAction({
      actionType: 'MEDIA_CONTROL',
      mediaAction: 'mute',
      confirmedByUser: true,
    });
    expect(muteRes.success).toBe(true);
    expect(mockTabsUpdate).toHaveBeenCalledWith(303, { muted: true });
    expect(mockTabsSendMessage).toHaveBeenCalledWith(303, { command: 'MEDIA_CONTROL', action: 'mute' });
  });

  it('handles content script media controls and page summary extraction', () => {
    const mockVideo = {
      paused: true,
      muted: false,
      play: vi.fn(),
      pause: vi.fn(),
    };
    const mockDoc = {
      title: 'Test Page',
      body: { innerText: 'Hello world from Edge companion.' },
      querySelector: vi.fn((selector: string) => {
        if (selector === 'video, audio') return mockVideo;
        if (selector === 'meta[name="description"]') return { getAttribute: () => 'Page desc' };
        return null;
      }),
      querySelectorAll: vi.fn(() => [{ textContent: 'Heading One' }]),
    } as unknown as Document;

    const play = handleContentMessage({ command: 'MEDIA_CONTROL', action: 'play' }, mockDoc, {
      href: 'https://example.com',
    } as Location);
    expect(play.state).toBe('PLAYING');
    expect(mockVideo.play).toHaveBeenCalled();

    const mute = handleContentMessage({ command: 'MEDIA_CONTROL', action: 'mute' }, mockDoc, {
      href: 'https://example.com',
    } as Location);
    expect(mute.state).toBe('MUTED');
    expect(mockVideo.muted).toBe(true);

    const summary = handleContentMessage({ command: 'READ_PAGE_SUMMARY' }, mockDoc, {
      href: 'https://example.com',
    } as Location);
    expect(summary.success).toBe(true);
    expect((summary.summary as { title: string; headings: string[] }).title).toBe('Test Page');
    expect((summary.summary as { headings: string[] }).headings).toEqual(['Heading One']);
  });
});

describe('RelayWebSocketClient (Persistent Relay + Heartbeat + Reconnect)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('connects to relay WS, sends heartbeats, and reconnects on close', () => {
    const instances: any[] = [];
    class MockWebSocket {
      readyState = 0;
      sent: string[] = [];
      onopen: (() => void) | null = null;
      onmessage: ((ev: MessageEvent) => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public url: string) {
        instances.push(this);
      }

      send(data: string) {
        this.sent.push(data);
      }

      close() {
        this.readyState = 3;
        this.onclose?.();
      }
    }

    const onMessage = vi.fn();
    const client = new RelayWebSocketClient({
      url: 'ws://localhost:3001/api/devices/relay/ws',
      heartbeatIntervalMs: 5000,
      baseReconnectDelayMs: 1000,
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
      onMessage,
    });

    client.connect();
    expect(instances).toHaveLength(1);
    expect(instances[0].url).toBe('ws://localhost:3001/api/devices/relay/ws');

    // Simulate open -> sends REGISTER + initial HEARTBEAT
    instances[0].readyState = 1;
    instances[0].onopen?.();
    expect(client.getStatus()).toBe('CONNECTED');
    expect(instances[0].sent).toHaveLength(2);
    expect(JSON.parse(instances[0].sent[0])).toMatchObject({
      type: 'REGISTER',
      payload: { deviceType: 'BROWSER_EXTENSION', browser: 'edge' },
    });
    expect(JSON.parse(instances[0].sent[1]).type).toBe('HEARTBEAT');

    // Advance 5s for next heartbeat
    vi.advanceTimersByTime(5000);
    expect(instances[0].sent).toHaveLength(3);

    // Simulate incoming relay message
    instances[0].onmessage?.({
      data: JSON.stringify({ type: 'KILL_SWITCH_TRIGGERED', payload: { isActivated: true } }),
    } as MessageEvent);
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'KILL_SWITCH_TRIGGERED' })
    );

    // Simulate disconnect -> schedules reconnect after 1000ms
    instances[0].close();
    expect(client.getStatus()).toBe('DISCONNECTED');
    vi.advanceTimersByTime(1000);
    expect(instances).toHaveLength(2);

    client.disconnect();
  });
});

describe('Sanctioned WhatsApp Web Bridge', () => {
  let service: BrowserCompanionService;
  let mockTabsQuery: ReturnType<typeof vi.fn>;
  let mockTabsSendMessage: ReturnType<typeof vi.fn>;
  let mockPermissionsContains: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new BrowserCompanionService();
    mockTabsQuery = vi.fn();
    mockTabsSendMessage = vi.fn();
    mockPermissionsContains = vi.fn().mockResolvedValue(true);

    (globalThis as any).chrome = {
      tabs: {
        query: mockTabsQuery,
        sendMessage: mockTabsSendMessage,
      },
      permissions: {
        contains: mockPermissionsContains,
      },
    };
    (globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards WHATSAPP_SEARCH_DOCUMENT to WhatsApp Web tab and notifies API on download', async () => {
    mockTabsQuery.mockResolvedValueOnce([{ id: 501, url: 'https://web.whatsapp.com/' }]);
    mockTabsSendMessage.mockResolvedValueOnce({
      success: true,
      fileName: 'CS101_syllabus.pdf',
      fileType: 'pdf',
      matchedChat: 'University Group',
      downloadTriggered: true,
    });

    const res = await service.handleAction({
      actionType: 'WHATSAPP_SEARCH_DOCUMENT',
      query: 'syllabus',
      chatName: 'University Group',
      confirmedByUser: true,
    });

    expect(res.success).toBe(true);
    expect(res.result).toContain('CS101_syllabus.pdf');
    expect(mockTabsSendMessage).toHaveBeenCalledWith(501, {
      command: 'WHATSAPP_SEARCH_AND_DOWNLOAD',
      query: 'syllabus',
      chatName: 'University Group',
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/whatsapp/document-downloaded',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('forwards WHATSAPP_CALL to WhatsApp Web tab and falls back to whatsapp:// when closed', async () => {
    mockTabsQuery.mockResolvedValueOnce([{ id: 501, url: 'https://web.whatsapp.com/' }]);
    mockTabsSendMessage.mockResolvedValueOnce({
      success: true,
      contactName: 'Mom',
      method: 'WEB_UI',
    });

    const webCall = await service.handleAction({
      actionType: 'WHATSAPP_CALL',
      contactName: 'Mom',
      confirmedByUser: true,
    });
    expect(webCall.success).toBe(true);
    expect(webCall.result).toContain('WhatsApp Web call UI');

    mockTabsQuery.mockResolvedValueOnce([]);
    const fallbackCall = await service.handleAction({
      actionType: 'WHATSAPP_CALL',
      contactName: 'Mom',
      confirmedByUser: true,
    });
    expect(fallbackCall.success).toBe(true);
    expect((fallbackCall.data as { handoffUrl: string }).handoffUrl).toContain('whatsapp://send');
  });

  it('WhatsAppWebBridge detects login state, downloads matching PDF/DOCX, and triggers call UI', () => {
    const downloadClick = vi.fn();
    const callClick = vi.fn();
    const chatClick = vi.fn();

    const mockSearchInput = {
      value: '',
      focus: vi.fn(),
      dispatchEvent: vi.fn(),
    };

    const mockDoc = {
      querySelector: vi.fn((selector: string) => {
        if (selector.includes('qrcode')) return null;
        if (selector.includes('chat-list')) return { id: 'pane-side' };
        if (selector.includes('voice-call-btn')) return { click: callClick };
        return null;
      }),
      querySelectorAll: vi.fn((selector: string) => {
        if (selector.includes('cell-frame-container')) {
          return [{ textContent: 'Mom', click: chatClick, getAttribute: (): string => 'Mom' }];
        }
        if (selector.includes('document-thumb')) {
          return [
            {
              textContent: 'Fall_2026_Syllabus.pdf',
              getAttribute: (): string => 'Fall_2026_Syllabus.pdf',
              querySelector: () => ({ click: downloadClick }),
            },
          ];
        }
        return [];
      }),
    } as unknown as Document;

    // Also provide search box on second querySelector call for search input
    (mockDoc.querySelector as ReturnType<typeof vi.fn>).mockImplementation((selector: string) => {
      if (selector.includes('qrcode')) return null;
      if (selector.includes('chat-list-search')) return mockSearchInput;
      if (selector.includes('chat-list')) return { id: 'pane-side' };
      if (selector.includes('voice-call-btn')) return { click: callClick };
      return null;
    });

    const bridge = new WhatsAppWebBridge(mockDoc);
    expect(bridge.isSignedIn()).toBe(true);

    const docRes = bridge.searchAndDownloadDocument('syllabus');
    expect(docRes.success).toBe(true);
    expect(docRes.fileName).toBe('Fall_2026_Syllabus.pdf');
    expect(docRes.fileType).toBe('pdf');
    expect(downloadClick).toHaveBeenCalled();

    const callRes = bridge.locateContactAndTriggerCall('Mom');
    expect(callRes.success).toBe(true);
    expect(callRes.method).toBe('WEB_UI');
    expect(chatClick).toHaveBeenCalled();
    expect(callClick).toHaveBeenCalled();
  });

  it('dispatches EDGE_OPEN_NEW_TAB, EDGE_ACTION, WHATSAPP_SEARCH_DOCUMENT, WHATSAPP_CALL and emits EDGE_RESULT + WHATSAPP_DOCUMENT_FOUND', async () => {
    const sentFrames: Array<Record<string, unknown>> = [];
    class MockRelaySocket {
      readyState = 1;
      onopen: (() => void) | null = null;
      onmessage: ((ev: MessageEvent) => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public url: string) {}
      send(data: string) {
        sentFrames.push(JSON.parse(data) as Record<string, unknown>);
      }
      close() {
        this.readyState = 3;
      }
    }

    const mockTabsCreate = vi.fn().mockResolvedValue({ id: 700, url: 'https://github.com/' });
    const mockTabsQuery = vi.fn().mockResolvedValue([{ id: 501, url: 'https://web.whatsapp.com/' }]);
    const mockTabsSendMessage = vi.fn().mockResolvedValue({
      success: true,
      fileName: 'syllabus.pdf',
      fileType: 'pdf',
      matchedChat: 'CS101',
      downloadTriggered: true,
    });

    (globalThis as any).chrome = {
      tabs: {
        create: mockTabsCreate,
        query: mockTabsQuery,
        update: vi.fn(),
        sendMessage: mockTabsSendMessage,
      },
      permissions: { contains: vi.fn().mockResolvedValue(true) },
      storage: { local: { set: vi.fn().mockResolvedValue(undefined) } },
    };
    (globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: true });

    const relayService = new BrowserCompanionService();
    const client = relayService.startRelay('ws://localhost:3001/api/devices/relay/ws', {
      WebSocketImpl: MockRelaySocket as unknown as typeof WebSocket,
    });

    await relayService.handleRelayMessage({
      id: 'req-1',
      type: 'EDGE_OPEN_NEW_TAB',
      payload: { url: 'github.com' },
    });
    expect(mockTabsCreate).toHaveBeenCalledWith({ url: 'https://github.com/' });
    expect(sentFrames.some((f) => f.type === 'EDGE_RESULT' && f.requestId === 'req-1' && f.success === true)).toBe(
      true
    );

    await relayService.handleRelayMessage({
      id: 'req-2',
      type: 'EDGE_ACTION',
      payload: { action: 'list_open_tabs' },
    });
    expect(sentFrames.some((f) => f.type === 'EDGE_RESULT' && f.requestId === 'req-2' && f.success === true)).toBe(
      true
    );

    await relayService.handleRelayMessage({
      id: 'req-3',
      type: 'WHATSAPP_SEARCH_DOCUMENT',
      payload: { keyword: 'syllabus' },
    });
    expect(sentFrames.some((f) => f.type === 'WHATSAPP_DOCUMENT_FOUND')).toBe(true);
    expect(sentFrames.some((f) => f.type === 'EDGE_RESULT' && f.requestId === 'req-3' && f.success === true)).toBe(
      true
    );

    client.disconnect();
  });
});
