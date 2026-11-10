import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BrowserCompanionService, BrowserActionRequest } from '../background.js';

describe('BrowserCompanionService (Manifest V3 Companion)', () => {
  let service: BrowserCompanionService;
  let mockTabsCreate: ReturnType<typeof vi.fn>;
  let mockTabsQuery: ReturnType<typeof vi.fn>;
  let mockTabsUpdate: ReturnType<typeof vi.fn>;
  let mockTabsSendMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new BrowserCompanionService();
    mockTabsCreate = vi.fn().mockResolvedValue({ id: 101, url: 'https://example.com' });
    mockTabsQuery = vi.fn().mockResolvedValue([{ id: 101, active: true }]);
    mockTabsUpdate = vi.fn().mockResolvedValue({ id: 101 });
    mockTabsSendMessage = vi.fn().mockResolvedValue({ state: 'PLAYING' });

    (globalThis as any).chrome = {
      tabs: {
        create: mockTabsCreate,
        query: mockTabsQuery,
        update: mockTabsUpdate,
        sendMessage: mockTabsSendMessage,
      },
      runtime: {
        onMessage: {
          addListener: vi.fn(),
        },
      },
    };
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
    expect(mockTabsCreate).toHaveBeenCalledWith({ url: 'https://developer.mozilla.org' });
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
    expect(mockTabsUpdate).toHaveBeenCalledWith(101, { url: 'https://github.com' });
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
});
