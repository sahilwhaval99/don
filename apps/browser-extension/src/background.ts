import { RelayWebSocketClient, RelayEnvelope } from './relay-client.js';

export { RelayWebSocketClient };
export type { RelayEnvelope };

export type MediaAction = 'play' | 'pause' | 'mute' | 'unmute' | 'toggle';

export type BrowserActionType =
  | 'OPEN_TAB'
  | 'OPEN_NEW_TAB'
  | 'NAVIGATE'
  | 'SWITCH_TAB'
  | 'LIST_OPEN_TABS'
  | 'READ_ACTIVE_PAGE_SUMMARY'
  | 'MEDIA_CONTROL'
  | 'YOUTUBE_PLAY_PAUSE'
  | 'YOUTUBE_SEARCH'
  | 'WHATSAPP_SEARCH_DOCUMENT'
  | 'WHATSAPP_CALL';

export interface BrowserActionRequest {
  actionType: BrowserActionType;
  targetUrl?: string;
  query?: string;
  mediaAction?: MediaAction;
  chatName?: string;
  contactName?: string;
  confirmedByUser: boolean;
}

export interface BrowserActionResult<T = unknown> {
  success: boolean;
  result?: string;
  data?: T;
  error?: string;
}

export interface OpenTabInfo {
  id: number;
  title: string;
  url: string;
  active: boolean;
  windowId?: number;
  audible?: boolean;
  muted?: boolean;
}

const DEFAULT_API_BASE = 'http://localhost:3001';
const DEFAULT_RELAY_WS_URL = 'ws://localhost:3001/api/devices/relay/ws';

function normalizeHttpUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: 'Target URL is missing.' };
  }

  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, error: `Blocked unsafe URL protocol: ${parsed.protocol}` };
    }
    return { ok: true, url: parsed.toString() };
  } catch {
    return { ok: false, error: `Invalid URL: ${raw}` };
  }
}

export class BrowserCompanionService {
  private killSwitchActive = false;
  private relayClient: RelayWebSocketClient | null = null;
  private readonly apiBaseUrl: string;

  constructor(options?: { apiBaseUrl?: string }) {
    this.apiBaseUrl = options?.apiBaseUrl ?? DEFAULT_API_BASE;
  }

  setKillSwitch(active: boolean): void {
    this.killSwitchActive = active;
  }

  isKillSwitchActive(): boolean {
    return this.killSwitchActive;
  }

  async openNewTab(rawUrl?: string): Promise<BrowserActionResult<{ tabId?: number; url: string }>> {
    if (!rawUrl) {
      return { success: false, error: 'Target URL is missing.' };
    }
    const normalized = normalizeHttpUrl(rawUrl);
    if (!normalized.ok) {
      return { success: false, error: normalized.error };
    }

    const tab = await chrome.tabs.create({ url: normalized.url });
    return {
      success: true,
      result: `Opened approved tab: ${normalized.url}`,
      data: { tabId: tab?.id, url: normalized.url },
    };
  }

  async listOpenTabs(): Promise<BrowserActionResult<{ tabs: OpenTabInfo[] }>> {
    const rawTabs = await chrome.tabs.query({});
    const tabs: OpenTabInfo[] = rawTabs
      .filter((t): t is chrome.tabs.Tab & { id: number } => typeof t.id === 'number')
      .map((t) => ({
        id: t.id,
        title: t.title || '',
        url: t.url || '',
        active: Boolean(t.active),
        windowId: t.windowId,
        audible: Boolean(t.audible),
        muted: Boolean(t.mutedInfo?.muted),
      }));

    return {
      success: true,
      result: `Found ${tabs.length} open tab(s).`,
      data: { tabs },
    };
  }

  async switchTab(query?: string): Promise<BrowserActionResult<{ tab: OpenTabInfo }>> {
    const trimmed = query?.trim();
    if (!trimmed) {
      return { success: false, error: 'Tab query is missing.' };
    }

    const tabs = await chrome.tabs.query({});
    const lower = trimmed.toLowerCase();
    const numericId = /^\d+$/.test(trimmed) ? Number(trimmed) : null;

    const match = tabs.find((t) => {
      if (numericId !== null && t.id === numericId) return true;
      const title = (t.title || '').toLowerCase();
      const url = (t.url || '').toLowerCase();
      return title.includes(lower) || url.includes(lower);
    });

    if (!match || typeof match.id !== 'number') {
      return { success: false, error: `No open tab matched query: "${trimmed}".` };
    }

    await chrome.tabs.update(match.id, { active: true });
    if (typeof match.windowId === 'number' && chrome.windows?.update) {
      await chrome.windows.update(match.windowId, { focused: true });
    }

    const tabInfo: OpenTabInfo = {
      id: match.id,
      title: match.title || '',
      url: match.url || '',
      active: true,
      windowId: match.windowId,
      audible: Boolean(match.audible),
      muted: Boolean(match.mutedInfo?.muted),
    };

    return {
      success: true,
      result: `Switched to tab: ${tabInfo.title || tabInfo.url || tabInfo.id}`,
      data: { tab: tabInfo },
    };
  }

  async hasDomainPermission(urlString: string): Promise<boolean> {
    if (!chrome.permissions?.contains) {
      return true;
    }
    try {
      const origin = new URL(urlString).origin;
      return await chrome.permissions.contains({ origins: [`${origin}/*`] });
    } catch {
      return false;
    }
  }

  async readActivePageSummary(): Promise<BrowserActionResult<Record<string, unknown>>> {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) {
      return { success: false, error: 'No active tab detected.' };
    }

    if (!activeTab.url || (!activeTab.url.startsWith('http://') && !activeTab.url.startsWith('https://'))) {
      return { success: false, error: 'Active tab is not a readable web page.' };
    }

    const permitted = await this.hasDomainPermission(activeTab.url);
    if (!permitted) {
      const origin = new URL(activeTab.url).origin;
      return {
        success: false,
        error: `Explicit domain permission required for ${origin}. Grant site access in Microsoft Edge extension settings.`,
      };
    }

    const response = await chrome.tabs.sendMessage(activeTab.id, { command: 'READ_PAGE_SUMMARY' });
    if (!response || response.error) {
      return {
        success: false,
        error: (response?.error as string) || 'Failed to read active page summary.',
      };
    }

    return {
      success: true,
      result: `Read summary from ${activeTab.title || activeTab.url}`,
      data: (response.summary as Record<string, unknown>) || response,
    };
  }

  async mediaControl(action: MediaAction = 'toggle'): Promise<BrowserActionResult<Record<string, unknown>>> {
    const ytTabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
    let targetTab = ytTabs.find((t) => t.active) ?? ytTabs[0];

    if (!targetTab) {
      const audibleTabs = await chrome.tabs.query({ audible: true });
      targetTab = audibleTabs[0];
    }

    if (!targetTab?.id) {
      return { success: false, error: 'No active media or YouTube tab is currently open.' };
    }

    if (action === 'mute' || action === 'unmute') {
      const shouldMute = action === 'mute';
      await chrome.tabs.update(targetTab.id, { muted: shouldMute });
    }

    const msgResponse = await chrome.tabs.sendMessage(targetTab.id, {
      command: 'MEDIA_CONTROL',
      action,
    });

    return {
      success: true,
      result: `Dispatched media ${action} to ${targetTab.title || 'media tab'}.`,
      data: (msgResponse as Record<string, unknown>) || { action },
    };
  }

  async whatsappSearchDocument(
    query?: string,
    chatName?: string
  ): Promise<BrowserActionResult<Record<string, unknown>>> {
    if (!query?.trim()) {
      return { success: false, error: 'Document search keyword is missing.' };
    }

    const waTabs = await chrome.tabs.query({ url: '*://web.whatsapp.com/*' });
    if (waTabs.length === 0 || !waTabs[0].id) {
      return {
        success: false,
        error: 'WhatsApp Web is not open in Microsoft Edge. Please open https://web.whatsapp.com and sign in.',
      };
    }

    const permitted = await this.hasDomainPermission('https://web.whatsapp.com/');
    if (!permitted) {
      return {
        success: false,
        error: 'Explicit site permission for https://web.whatsapp.com is required.',
      };
    }

    const response = (await chrome.tabs.sendMessage(waTabs[0].id, {
      command: 'WHATSAPP_SEARCH_AND_DOWNLOAD',
      query: query.trim(),
      chatName,
    })) as {
      success?: boolean;
      fileName?: string;
      fileType?: string;
      matchedChat?: string;
      downloadTriggered?: boolean;
      error?: string;
    };

    if (!response?.success) {
      return {
        success: false,
        error: response?.error || 'Failed to locate or download WhatsApp document.',
      };
    }

    // Notify relay & API so Desktop Agent can open the downloaded document
    this.notifyDocumentDownloaded({
      fileName: response.fileName || query.trim(),
      fileType: response.fileType || 'pdf',
      matchedChat: response.matchedChat || chatName,
      query: query.trim(),
    });

    return {
      success: true,
      result: `Triggered download for ${response.fileName || query} from WhatsApp Web.`,
      data: response,
    };
  }

  async whatsappCall(contactName?: string): Promise<BrowserActionResult<Record<string, unknown>>> {
    if (!contactName?.trim()) {
      return { success: false, error: 'Contact name is missing.' };
    }

    const waTabs = await chrome.tabs.query({ url: '*://web.whatsapp.com/*' });
    if (waTabs.length > 0 && waTabs[0].id) {
      const permitted = await this.hasDomainPermission('https://web.whatsapp.com/');
      if (!permitted) {
        return {
          success: false,
          error: 'Explicit site permission for https://web.whatsapp.com is required.',
        };
      }

      const response = (await chrome.tabs.sendMessage(waTabs[0].id, {
        command: 'WHATSAPP_CALL_CONTACT',
        contactName: contactName.trim(),
      })) as {
        success?: boolean;
        contactName?: string;
        method?: string;
        handoffUrl?: string;
        error?: string;
      };

      if (!response?.success) {
        return {
          success: false,
          error: response?.error || `Failed to initiate WhatsApp call to ${contactName}.`,
        };
      }

      return {
        success: true,
        result:
          response.method === 'WEB_UI'
            ? `Triggered WhatsApp Web call UI for ${contactName}.`
            : `Prepared WhatsApp handoff for ${contactName}.`,
        data: response,
      };
    }

    // Fallback when WhatsApp Web tab is not open: return whatsapp:// protocol handoff
    const handoffUrl = `whatsapp://send?text=${encodeURIComponent(`Calling ${contactName.trim()}`)}`;
    return {
      success: true,
      result: `WhatsApp Web tab not open; prepared whatsapp:// handoff for ${contactName.trim()}.`,
      data: {
        contactName: contactName.trim(),
        method: 'PROTOCOL_HANDOFF',
        handoffUrl,
      },
    };
  }

  private notifyDocumentDownloaded(info: {
    fileName: string;
    fileType: string;
    matchedChat?: string;
    query: string;
  }): void {
    this.relayClient?.send({
      type: 'WHATSAPP_DOCUMENT_FOUND',
      source: 'EDGE_EXTENSION',
      payload: info,
      timestamp: new Date().toISOString(),
    });

    if (typeof fetch === 'function') {
      void fetch(`${this.apiBaseUrl}/api/whatsapp/document-downloaded`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(info),
      }).catch(() => {
        // Non-fatal if API is offline during standalone extension usage
      });
    }
  }

  async handleAction(request: BrowserActionRequest): Promise<BrowserActionResult> {
    if (this.killSwitchActive) {
      return {
        success: false,
        error: 'Kill switch is active. All browser actions are halted.',
      };
    }

    if (!request.confirmedByUser) {
      return {
        success: false,
        error: 'Security Warning: Browser action rejected. Explicit user confirmation required.',
      };
    }

    try {
      switch (request.actionType) {
        case 'OPEN_TAB':
        case 'OPEN_NEW_TAB':
          return await this.openNewTab(request.targetUrl);

        case 'NAVIGATE': {
          if (!request.targetUrl) return { success: false, error: 'Target URL is missing.' };
          const normalized = normalizeHttpUrl(request.targetUrl);
          if (!normalized.ok) return { success: false, error: normalized.error };
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (activeTab?.id) {
            await chrome.tabs.update(activeTab.id, { url: normalized.url });
            return { success: true, result: `Navigated current tab to: ${normalized.url}` };
          }
          return { success: false, error: 'No active tab detected.' };
        }

        case 'LIST_OPEN_TABS':
          return await this.listOpenTabs();

        case 'SWITCH_TAB':
          return await this.switchTab(request.query ?? request.targetUrl);

        case 'READ_ACTIVE_PAGE_SUMMARY':
          return await this.readActivePageSummary();

        case 'MEDIA_CONTROL':
          return await this.mediaControl(request.mediaAction ?? 'toggle');

        case 'YOUTUBE_PLAY_PAUSE': {
          const ytTabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
          if (ytTabs.length === 0 || !ytTabs[0].id) {
            return { success: false, error: 'No YouTube tab is currently open.' };
          }
          await chrome.tabs.sendMessage(ytTabs[0].id, { command: 'TOGGLE_PLAYBACK' });
          return { success: true, result: 'Dispatched play/pause toggle to YouTube.' };
        }

        case 'YOUTUBE_SEARCH': {
          const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
            request.query || request.targetUrl || ''
          )}`;
          await chrome.tabs.create({ url: searchUrl });
          return { success: true, result: `Opened YouTube search for query.` };
        }

        case 'WHATSAPP_SEARCH_DOCUMENT':
          return await this.whatsappSearchDocument(request.query ?? request.targetUrl, request.chatName);

        case 'WHATSAPP_CALL':
          return await this.whatsappCall(request.contactName ?? request.query ?? request.targetUrl);

        default:
          return { success: false, error: 'Unsupported browser action type.' };
      }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown extension error' };
    }
  }

  private mapRelayToActionRequest(msg: RelayEnvelope): BrowserActionRequest | null {
    const payload = msg.payload ?? {};

    switch (msg.type) {
      case 'BROWSER_ACTION':
        return payload as unknown as BrowserActionRequest;

      case 'EDGE_OPEN_NEW_TAB':
        return {
          actionType: 'OPEN_NEW_TAB',
          targetUrl: (payload.url as string) ?? (payload.targetUrl as string),
          confirmedByUser: payload.confirmedByUser !== false,
        };

      case 'EDGE_ACTION': {
        const rawAction = String(
          payload.actionType ?? payload.action ?? ''
        ).toUpperCase() as BrowserActionType;
        return {
          actionType: rawAction,
          targetUrl: (payload.url as string) ?? (payload.targetUrl as string),
          query: payload.query as string | undefined,
          mediaAction: (payload.mediaAction as MediaAction) ?? (payload.command as MediaAction),
          chatName: payload.chatName as string | undefined,
          contactName: payload.contactName as string | undefined,
          confirmedByUser: payload.confirmedByUser !== false,
        };
      }

      case 'WHATSAPP_SEARCH_DOCUMENT':
        return {
          actionType: 'WHATSAPP_SEARCH_DOCUMENT',
          query: (payload.query as string) ?? (payload.keyword as string),
          chatName: payload.chatName as string | undefined,
          confirmedByUser: payload.confirmedByUser !== false,
        };

      case 'WHATSAPP_CALL':
        return {
          actionType: 'WHATSAPP_CALL',
          contactName:
            (payload.contactName as string) ??
            (payload.contact as string) ??
            (payload.phoneNumber as string),
          confirmedByUser: payload.confirmedByUser !== false,
        };

      default:
        return null;
    }
  }

  async handleRelayMessage(msg: RelayEnvelope): Promise<void> {
    if (msg.type === 'CONNECTED' && typeof msg.killSwitchActive === 'boolean') {
      this.setKillSwitch(msg.killSwitchActive);
      return;
    }
    if (msg.type === 'KILL_SWITCH_TRIGGERED') {
      const active = Boolean(msg.payload?.isActivated);
      this.setKillSwitch(active);
      return;
    }

    const req = this.mapRelayToActionRequest(msg);
    if (!req) {
      return;
    }

    const result = await this.handleAction(req);
    this.relayClient?.send({
      type: 'EDGE_RESULT',
      requestId: msg.id,
      actionType: msg.type,
      payload: result as unknown as Record<string, unknown>,
      ...result,
      timestamp: new Date().toISOString(),
    });
  }

  startRelay(
    wsUrl: string = DEFAULT_RELAY_WS_URL,
    options?: { WebSocketImpl?: typeof WebSocket }
  ): RelayWebSocketClient {
    if (this.relayClient) {
      this.relayClient.disconnect();
    }

    this.relayClient = new RelayWebSocketClient({
      url: wsUrl,
      WebSocketImpl: options?.WebSocketImpl,
      onStatusChange: (status) => {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          void chrome.storage.local.set({
            relayStatus: status,
            relayUpdatedAt: new Date().toISOString(),
          });
        }
      },
      onMessage: async (msg) => {
        await this.handleRelayMessage(msg);
      },
    });

    this.relayClient.connect();
    return this.relayClient;
  }
}

const service = new BrowserCompanionService();

// Initialize MV3 service worker listeners & persistent WebSocket relay
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  service.startRelay();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'RECONNECT_RELAY') {
      service.startRelay();
      sendResponse({ success: true });
      return true;
    }
    service.handleAction(message).then(sendResponse);
    return true; // Keep message channel open for async response
  });
}
