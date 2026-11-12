export interface WhatsAppDocumentResult {
  success: boolean;
  requiresLogin?: boolean;
  fileName?: string;
  fileType?: 'pdf' | 'docx' | 'doc' | 'unknown';
  matchedChat?: string;
  downloadTriggered?: boolean;
  error?: string;
}

export interface WhatsAppCallResult {
  success: boolean;
  requiresLogin?: boolean;
  contactName?: string;
  method?: 'WEB_UI' | 'PROTOCOL_HANDOFF';
  handoffUrl?: string;
  error?: string;
}

export type WhatsAppBridgeCommand =
  | { command: 'WHATSAPP_STATUS' }
  | { command: 'WHATSAPP_SEARCH_AND_DOWNLOAD'; query: string; chatName?: string }
  | { command: 'WHATSAPP_CALL_CONTACT'; contactName: string };

const DOC_EXTENSION_REGEX = /\.(pdf|docx|doc)\b/i;

function getDocumentExtension(text: string): 'pdf' | 'docx' | 'doc' | 'unknown' {
  const match = text.match(DOC_EXTENSION_REGEX);
  if (!match) return 'unknown';
  const ext = match[1].toLowerCase();
  if (ext === 'pdf' || ext === 'docx' || ext === 'doc') return ext;
  return 'unknown';
}

function setSearchInputValue(input: Element, value: string): void {
  const focusable = input as unknown as { focus?: () => void; value?: string; textContent?: string | null };
  focusable.focus?.();

  if (typeof HTMLInputElement !== 'undefined' && (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }

  if ('value' in focusable && typeof focusable.value === 'string') {
    focusable.value = value;
    input.dispatchEvent?.(new Event('input', { bubbles: true }));
    return;
  }

  // WhatsApp Web uses contenteditable divs for search inputs
  focusable.textContent = value;
  if (typeof InputEvent !== 'undefined') {
    input.dispatchEvent?.(new InputEvent('input', { bubbles: true, data: value }));
  } else if (typeof Event !== 'undefined') {
    input.dispatchEvent?.(new Event('input', { bubbles: true }));
  }
}

function triggerClick(el: unknown): void {
  if (el && typeof (el as { click?: unknown }).click === 'function') {
    (el as { click: () => void }).click();
  }
}

export class WhatsAppWebBridge {
  constructor(private readonly doc: Document = document) {}

  isSignedIn(): boolean {
    const qrCode = this.doc.querySelector('[data-testid="qrcode"], canvas[aria-label*="Scan"]');
    if (qrCode) {
      return false;
    }
    const chatList = this.doc.querySelector(
      '#pane-side, [data-testid="chat-list"], [aria-label*="Chat list"]'
    );
    return Boolean(chatList);
  }

  searchAndDownloadDocument(query: string, chatName?: string): WhatsAppDocumentResult {
    if (!this.isSignedIn()) {
      return {
        success: false,
        requiresLogin: true,
        error: 'WhatsApp Web is not signed in. Please scan the QR code in Microsoft Edge first.',
      };
    }

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return { success: false, error: 'Document search keyword is required.' };
    }

    const searchBox = this.doc.querySelector(
      '[data-testid="chat-list-search"], [contenteditable="true"][data-tab="3"], input[type="text"]'
    );
    if (searchBox) {
      setSearchInputValue(searchBox, chatName?.trim() || query.trim());
    }

    // If a specific chat is requested, try clicking the matching chat row
    if (chatName) {
      const targetChat = chatName.trim().toLowerCase();
      const chatItems = Array.from(
        this.doc.querySelectorAll('[data-testid="cell-frame-container"], [role="listitem"], #pane-side [title]')
      );
      const matchedRow = chatItems.find((el) =>
        (el.textContent || el.getAttribute('title') || '').toLowerCase().includes(targetChat)
      );
      if (matchedRow) {
        triggerClick(matchedRow);
      }
    }

    // Locate matching PDF/DOCX/DOC attachment in the active chat or search results
    const attachmentCandidates = Array.from(
      this.doc.querySelectorAll(
        '[data-testid="document-thumb"], [data-testid="msg-container"], a[download], [data-testid="media-download"]'
      )
    );

    for (const candidate of attachmentCandidates) {
      const fields = [
        candidate.textContent || '',
        candidate.getAttribute('title') || '',
        candidate.getAttribute('download') || '',
        candidate.getAttribute('aria-label') || '',
      ];
      const candidateText = fields.join(' ').trim();

      const lower = candidateText.toLowerCase();
      if (lower.includes(normalizedQuery) && DOC_EXTENSION_REGEX.test(lower)) {
        const downloadBtn =
          candidate.querySelector('[data-testid="media-download"], [aria-label*="Download"], a[download]') ||
          candidate;

        triggerClick(downloadBtn);

        const fileNameMatch = fields
          .map((f) => f.match(/[\w.\- ()]+\.(pdf|docx|doc)/i)?.[0]?.trim())
          .find(Boolean);
        const fileName = fileNameMatch || `${query.trim()}.pdf`;

        return {
          success: true,
          fileName,
          fileType: getDocumentExtension(fileName),
          matchedChat: chatName || 'Active Chat',
          downloadTriggered: true,
        };
      }
    }

    return {
      success: false,
      error: `No PDF/DOCX attachment matching "${query}" found in visible WhatsApp Web chats.`,
    };
  }

  locateContactAndTriggerCall(contactName: string): WhatsAppCallResult {
    if (!this.isSignedIn()) {
      return {
        success: false,
        requiresLogin: true,
        error: 'WhatsApp Web is not signed in. Please scan the QR code in Microsoft Edge first.',
      };
    }

    const trimmedName = contactName.trim();
    if (!trimmedName) {
      return { success: false, error: 'Contact name is required.' };
    }

    const searchBox = this.doc.querySelector(
      '[data-testid="chat-list-search"], [contenteditable="true"][data-tab="3"], input[type="text"]'
    );
    if (searchBox) {
      setSearchInputValue(searchBox, trimmedName);
    }

    const normalizedTarget = trimmedName.toLowerCase();
    const chatItems = Array.from(
      this.doc.querySelectorAll('[data-testid="cell-frame-container"], [role="listitem"], #pane-side [title]')
    );
    const matchedChat = chatItems.find((el) =>
      (el.textContent || el.getAttribute('title') || '').toLowerCase().includes(normalizedTarget)
    );

    if (matchedChat) {
      triggerClick(matchedChat);
    }

    const callButton = this.doc.querySelector(
      '[data-testid="voice-call-btn"], [aria-label*="Voice call"], [title*="Voice call"]'
    );

    if (callButton && matchedChat) {
      triggerClick(callButton);
      return {
        success: true,
        contactName: trimmedName,
        method: 'WEB_UI',
      };
    }

    // Fallback to whatsapp:// protocol handoff for WhatsApp Desktop on Windows
    const handoffUrl = `whatsapp://send?text=${encodeURIComponent(`Calling ${trimmedName}`)}`;
    return {
      success: true,
      contactName: trimmedName,
      method: 'PROTOCOL_HANDOFF',
      handoffUrl,
    };
  }

  handleMessage(request: WhatsAppBridgeCommand): WhatsAppDocumentResult | WhatsAppCallResult | { signedIn: boolean } {
    switch (request.command) {
      case 'WHATSAPP_STATUS':
        return { signedIn: this.isSignedIn() };
      case 'WHATSAPP_SEARCH_AND_DOWNLOAD':
        return this.searchAndDownloadDocument(request.query, request.chatName);
      case 'WHATSAPP_CALL_CONTACT':
        return this.locateContactAndTriggerCall(request.contactName);
    }
  }
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage && typeof document !== 'undefined') {
  const bridge = new WhatsAppWebBridge(document);
  chrome.runtime.onMessage.addListener((request: WhatsAppBridgeCommand, _sender, sendResponse) => {
    if (
      request?.command === 'WHATSAPP_STATUS' ||
      request?.command === 'WHATSAPP_SEARCH_AND_DOWNLOAD' ||
      request?.command === 'WHATSAPP_CALL_CONTACT'
    ) {
      sendResponse(bridge.handleMessage(request));
      return true;
    }
    return false;
  });
}
