export interface ContentMediaRequest {
  command: 'TOGGLE_PLAYBACK' | 'MEDIA_CONTROL' | 'READ_PAGE_SUMMARY';
  action?: 'play' | 'pause' | 'mute' | 'unmute' | 'toggle';
}

export interface PageSummary {
  title: string;
  url: string;
  description: string;
  headings: string[];
  textSnippet: string;
}

export function handleContentMessage(
  request: ContentMediaRequest,
  doc: Document = document,
  loc: Location = location
): Record<string, unknown> {
  if (request.command === 'TOGGLE_PLAYBACK' || request.command === 'MEDIA_CONTROL') {
    const media = doc.querySelector('video, audio') as HTMLMediaElement | null;
    if (!media) {
      return { error: 'No HTML5 media element found on page.' };
    }

    const action = request.command === 'TOGGLE_PLAYBACK' ? 'toggle' : request.action ?? 'toggle';

    switch (action) {
      case 'play':
        void media.play();
        return { state: 'PLAYING', muted: media.muted };
      case 'pause':
        media.pause();
        return { state: 'PAUSED', muted: media.muted };
      case 'mute':
        media.muted = true;
        return { state: 'MUTED', muted: true };
      case 'unmute':
        media.muted = false;
        return { state: 'UNMUTED', muted: false };
      case 'toggle':
      default:
        if (media.paused) {
          void media.play();
          return { state: 'PLAYING', muted: media.muted };
        } else {
          media.pause();
          return { state: 'PAUSED', muted: media.muted };
        }
    }
  }

  if (request.command === 'READ_PAGE_SUMMARY') {
    const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const headings = Array.from(doc.querySelectorAll('h1, h2'))
      .map((el) => (el.textContent || '').trim())
      .filter(Boolean)
      .slice(0, 5);
    const bodyText = (doc.body?.innerText || doc.body?.textContent || '').replace(/\s+/g, ' ').trim();

    const summary: PageSummary = {
      title: doc.title || '',
      url: loc.href || '',
      description: metaDesc,
      headings,
      textSnippet: bodyText.slice(0, 1500),
    };

    return { success: true, summary };
  }

  return { error: 'Unsupported content script command.' };
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage && typeof document !== 'undefined') {
  chrome.runtime.onMessage.addListener((request: ContentMediaRequest, _sender, sendResponse) => {
    if (
      request?.command === 'TOGGLE_PLAYBACK' ||
      request?.command === 'MEDIA_CONTROL' ||
      request?.command === 'READ_PAGE_SUMMARY'
    ) {
      sendResponse(handleContentMessage(request));
      return true;
    }
    return false;
  });
}
