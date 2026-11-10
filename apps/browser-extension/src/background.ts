// Manifest V3 Background Service Worker
export interface BrowserActionRequest {
  actionType: 'OPEN_TAB' | 'NAVIGATE' | 'YOUTUBE_PLAY_PAUSE' | 'YOUTUBE_SEARCH';
  targetUrl?: string;
  confirmedByUser: boolean;
}

export class BrowserCompanionService {
  async handleAction(request: BrowserActionRequest): Promise<{ success: boolean; result?: string; error?: string }> {
    if (!request.confirmedByUser) {
      return {
        success: false,
        error: 'Security Warning: Browser action rejected. Explicit user confirmation required.',
      };
    }

    try {
      switch (request.actionType) {
        case 'OPEN_TAB':
          if (!request.targetUrl) return { success: false, error: 'Target URL is missing.' };
          await chrome.tabs.create({ url: request.targetUrl });
          return { success: true, result: `Opened approved tab: ${request.targetUrl}` };

        case 'NAVIGATE': {
          if (!request.targetUrl) return { success: false, error: 'Target URL is missing.' };
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (activeTab?.id) {
            await chrome.tabs.update(activeTab.id, { url: request.targetUrl });
            return { success: true, result: `Navigated current tab to: ${request.targetUrl}` };
          }
          return { success: false, error: 'No active tab detected.' };
        }

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
            request.targetUrl || ''
          )}`;
          await chrome.tabs.create({ url: searchUrl });
          return { success: true, result: `Opened YouTube search for query.` };
        }

        default:
          return { success: false, error: 'Unsupported browser action type.' };
      }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown extension error' };
    }
  }
}

const service = new BrowserCompanionService();

// Listen for messages from popup or web dashboard relay
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    service.handleAction(message).then(sendResponse);
    return true; // Keep message channel open for async response
  });
}
