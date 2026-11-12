import {
  AllowedToolName,
  ToolCallProposal,
  WebSearchResultItem,
  DocumentSnippetCitation,
} from '@don/shared';
import { AIProvider, AIResponse, ChatMessage, AIContext, SearchProvider } from './types.js';
import { evaluateConsequence } from './consequences.js';
import { MultiSourceKnowledgeEngine } from './multi-source-knowledge.js';
import { DocumentRAGAnalyzer } from './document-rag.js';
import { enforceShortAnswerFirst, wantsDetailedResponse } from './jarvis-directive.js';

const KNOWN_WEBSITE_MAP: Record<string, string> = {
  youtube: 'https://www.youtube.com',
  github: 'https://github.com',
  google: 'https://www.google.com',
  gmail: 'https://mail.google.com',
  reddit: 'https://www.reddit.com',
  wikipedia: 'https://en.wikipedia.org',
  stackoverflow: 'https://stackoverflow.com',
  'stack overflow': 'https://stackoverflow.com',
  linkedin: 'https://www.linkedin.com',
  netflix: 'https://www.netflix.com',
  chatgpt: 'https://chatgpt.com',
  notion: 'https://www.notion.so',
  figma: 'https://www.figma.com',
  amazon: 'https://www.amazon.com',
  twitter: 'https://x.com',
  x: 'https://x.com',
  twitch: 'https://www.twitch.tv',
  instagram: 'https://www.instagram.com',
  facebook: 'https://www.facebook.com',
  'whatsapp web': 'https://web.whatsapp.com',
};

const KNOWN_APP_ALIASES: Array<{ keywords: string[]; appName: string }> = [
  { keywords: ['calculator', 'calc'], appName: 'Calculator' },
  { keywords: ['notepad'], appName: 'Notepad' },
  { keywords: ['terminal', 'powershell', 'cmd', 'wt'], appName: 'Terminal' },
  { keywords: ['mspaint', 'paint'], appName: 'Paint' },
  { keywords: ['vscode', 'vs code', 'visual studio code'], appName: 'Visual Studio Code' },
  { keywords: ['spotify'], appName: 'Spotify' },
  { keywords: ['discord'], appName: 'Discord' },
  { keywords: ['whatsapp'], appName: 'WhatsApp' },
  { keywords: ['msedge', 'microsoft edge', 'edge'], appName: 'Microsoft Edge' },
  { keywords: ['explorer', 'file explorer'], appName: 'File Explorer' },
];

export interface MockAIProviderOptions {
  knowledgeEngine?: MultiSourceKnowledgeEngine;
  searchProvider?: SearchProvider;
}

export class MockAIProvider implements AIProvider {
  name = 'IntelligentAssistantProvider';
  private knowledgeEngine: MultiSourceKnowledgeEngine;
  private customSearchProvider?: SearchProvider;
  private docAnalyzer = new DocumentRAGAnalyzer();

  constructor(options?: MockAIProviderOptions) {
    this.knowledgeEngine = options?.knowledgeEngine ?? new MultiSourceKnowledgeEngine();
    this.customSearchProvider = options?.searchProvider;
  }

  async generateResponse(messages: ChatMessage[], context?: AIContext): Promise<AIResponse> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    const userPrompt = (lastUserMessage?.content || '').trim();
    const lowerPrompt = userPrompt.toLowerCase();
    const isDetailed = wantsDetailedResponse(userPrompt);

    const toolProposals: ToolCallProposal[] = [];
    let reply = '';
    const citations: (WebSearchResultItem | DocumentSnippetCitation)[] = [];
    const usedMemories: Array<{ memoryId: string; key: string; reasonUsed: string }> = [];

    // 1. Recalled Memories
    if (context?.recentMemories && context.recentMemories.length > 0) {
      for (const mem of context.recentMemories) {
        if (
          lowerPrompt.includes(mem.key.toLowerCase()) ||
          lowerPrompt.includes('preference') ||
          lowerPrompt.includes('routine')
        ) {
          usedMemories.push({
            memoryId: mem.id,
            key: mem.key,
            reasonUsed: `Recalled stored preference "${mem.key}": ${mem.content}`,
          });
        }
      }
    }

    const websiteUrl = this.extractWebsiteUrl(userPrompt);

    // 2. Greetings
    if (/^(hi|hello|hey|good\s*(morning|afternoon|evening)|greetings)\b/i.test(lowerPrompt)) {
      const ownerName = context?.userName || 'Commander';
      reply = `Good day, ${ownerName}. DON is ready and synchronized across your desktop and companion systems. How may I assist?`;
    }
    // 3. Capabilities & Help
    else if (
      lowerPrompt.includes('what can you do') ||
      lowerPrompt.includes('capabilities') ||
      lowerPrompt.includes('help me') ||
      lowerPrompt === 'help' ||
      lowerPrompt.includes('who are you')
    ) {
      if (isDetailed) {
        reply = `I am **DON (Digital Operations Navigator)**: a secure, permission-governed, multi-device AI assistant.\n\n### Core Capabilities:\n- **Multi-Source Knowledge**: Parallel live queries across Wikipedia, DuckDuckGo, arXiv, StackExchange, GitHub, and Google News RSS.\n- **Microsoft Edge & Desktop Control**: Open websites in Edge tabs, manage Edge media/tabs, and launch Windows apps.\n- **WhatsApp Integration**: Search/download/open WhatsApp documents and initiate WhatsApp calls.\n- **Android Companion & Connected Docs**: Dialer/call proposals and semantic document Q&A.\n- **Emergency Kill Switch**: Instantly halt all active automations.`;
      } else {
        reply = `I am DON, your permission-governed multi-device assistant. I can answer live multi-source queries, control Microsoft Edge tabs and Windows apps, handle WhatsApp documents and calls, and manage tasks. What would you like to run?`;
      }
    }
    // 4. WhatsApp Call Intent (must precede generic phone call)
    else if (
      lowerPrompt.includes('whatsapp') &&
      (/\bcall\b/i.test(lowerPrompt) || lowerPrompt.includes('video call') || lowerPrompt.includes('voice call'))
    ) {
      const callType = lowerPrompt.includes('video') ? 'VIDEO' : 'VOICE';
      const contactName = this.extractWhatsAppContact(userPrompt);
      const params = {
        contactName,
        callType,
        reason: `Initiate WhatsApp ${callType.toLowerCase()} call to ${contactName}`,
      };
      const { requiresApproval, consequence } = evaluateConsequence('whatsapp_call', params);
      toolProposals.push({
        id: crypto.randomUUID(),
        toolName: 'whatsapp_call',
        parameters: params,
        consequence,
        requiresApproval,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      });
      reply = `Prepared a WhatsApp ${callType.toLowerCase()} call proposal for **${contactName}**. Approve to place the call via WhatsApp Desktop.`;
    }
    // 5. WhatsApp Document Search / Download / Open Intent
    else if (
      lowerPrompt.includes('whatsapp') &&
      /\b(search|find|download|open|get|fetch|doc|document|file|pdf|syllabus|notes|invoice)\b/i.test(lowerPrompt)
    ) {
      const query = this.extractWhatsAppDocQuery(userPrompt);
      const params = {
        query,
        openAfterDownload: true,
        openInEdge: true,
        reason: `Search, download, and open "${query}" from WhatsApp or local Downloads`,
      };
      const { requiresApproval, consequence } = evaluateConsequence('whatsapp_search_download_open', params);
      toolProposals.push({
        id: crypto.randomUUID(),
        toolName: 'whatsapp_search_download_open',
        parameters: params,
        consequence,
        requiresApproval,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      });
      reply = `Prepared a WhatsApp document search and open proposal for **"${query}"**. Approve to locate, download, and open the matching file.`;
    }
    // 6. Edge Browser Actions (tabs, page summary, media control)
    else if (this.detectEdgeBrowserAction(lowerPrompt)) {
      const action = this.detectEdgeBrowserAction(lowerPrompt)!;
      const { requiresApproval, consequence } = evaluateConsequence(action.toolName, action.params);
      toolProposals.push({
        id: crypto.randomUUID(),
        toolName: action.toolName,
        parameters: action.params,
        consequence,
        requiresApproval,
        status: requiresApproval ? 'PENDING' : 'EXECUTED',
        createdAt: new Date().toISOString(),
      });
      reply = action.reply;
    }
    // 7. Open Website in Microsoft Edge Intent
    else if (
      websiteUrl &&
      /\b(open|go to|visit|browse|navigate|launch)\b/i.test(lowerPrompt)
    ) {
      const params = {
        url: websiteUrl,
        browser: 'msedge',
        reason: `Open ${websiteUrl} in a new Microsoft Edge tab`,
      };
      const { requiresApproval, consequence } = evaluateConsequence('propose_open_website', params);
      toolProposals.push({
        id: crypto.randomUUID(),
        toolName: 'propose_open_website',
        parameters: params,
        consequence,
        requiresApproval,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      });
      reply = `Prepared a Microsoft Edge new-tab proposal for **${websiteUrl}**. Approve to open it in Edge.`;
    }
    // 8. Desktop App Launch Intent (any Windows app)
    else if (this.isDesktopAppLaunchIntent(lowerPrompt)) {
      const matched = this.resolveDesktopApp(userPrompt, context);
      const params: Record<string, unknown> = {
        ...(matched.appId ? { appId: matched.appId } : {}),
        appName: matched.appName,
        ...(matched.executablePath ? { executablePath: matched.executablePath } : {}),
        reason: `User requested to open ${matched.appName}`,
      };
      const { requiresApproval, consequence } = evaluateConsequence('propose_open_desktop_app', params);
      toolProposals.push({
        id: crypto.randomUUID(),
        toolName: 'propose_open_desktop_app',
        parameters: params,
        consequence,
        requiresApproval,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      });
      reply = `Submitted an approval request to launch **${matched.appName}** on your Windows desktop. Click **Approve & Execute** to run it.`;
    }
    // 9. Phone Call or Dialer Intent
    else if (
      lowerPrompt.includes('call') ||
      lowerPrompt.includes('dial') ||
      lowerPrompt.includes('phone')
    ) {
      const phoneMatch = userPrompt.match(/(\+?\d[\d\s\-()]{6,}\d)/);
      const phoneNumber = phoneMatch ? phoneMatch[0].trim() : '+1-555-0199';
      const isDirectCall =
        lowerPrompt.includes('direct call') || lowerPrompt.includes('place a call');

      const toolName: AllowedToolName = isDirectCall ? 'propose_phone_call' : 'propose_phone_dial';
      const params = isDirectCall
        ? {
            phoneNumber,
            reason: 'Initiate voice call to contact',
            explicitDirectCallConsentRequired: true,
          }
        : { phoneNumber, reason: 'Open phone dialer with specified number' };

      const { requiresApproval, consequence } = evaluateConsequence(toolName, params);
      toolProposals.push({
        id: crypto.randomUUID(),
        toolName,
        parameters: params,
        consequence,
        requiresApproval,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      });

      reply = isDirectCall
        ? `Prepared a direct call proposal to **${phoneNumber}**. Explicit phone-side approval is required before placing the call.`
        : `Prepared a dialer proposal for **${phoneNumber}** on your paired Android companion. Approve to populate the dialer.`;
    }
    // 10. Screen Capture / Screen Analysis Intent
    else if (
      lowerPrompt.includes('screen') ||
      lowerPrompt.includes('capture') ||
      lowerPrompt.includes('screenshot')
    ) {
      const params = {
        windowTitleOrTarget: 'Active Workspace Window',
        purpose: 'Analyze display contents for user troubleshooting',
      };
      const { requiresApproval, consequence } = evaluateConsequence('request_screen_capture', params);

      toolProposals.push({
        id: crypto.randomUUID(),
        toolName: 'request_screen_capture',
        parameters: params,
        consequence,
        requiresApproval,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      });

      reply = `Requested permission to capture a transient screenshot of your active window. Captures are inspected in memory and purged immediately after analysis.`;
    }
    // 11. Connected Document Query Intent
    else if (
      lowerPrompt.includes('document') ||
      lowerPrompt.includes('summary of pdf') ||
      (lowerPrompt.includes('file') && context?.connectedDocuments && context.connectedDocuments.length > 0)
    ) {
      if (context?.connectedDocuments && context.connectedDocuments.length > 0) {
        this.docAnalyzer.indexDocuments(
          context.connectedDocuments.map((d) => ({
            id: d.id,
            userId: context.userId,
            name: d.name,
            fileType: 'MARKDOWN',
            sizeBytes: d.text.length,
            pageCount: 1,
            rawText: d.text,
            summary: '',
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }))
        );
        const docResult = this.docAnalyzer.searchAndAnswer(userPrompt);
        citations.push(...docResult.citations);
        reply = docResult.answer;
      } else {
        reply = `No connected documents are uploaded in this session. Upload PDFs, Word files, or Markdown in the Knowledge Base tab to enable document Q&A.`;
      }
    }
    // 12. Task / Project / Reminder Intent
    else if (
      lowerPrompt.startsWith('task') ||
      lowerPrompt.startsWith('add task') ||
      lowerPrompt.startsWith('create task') ||
      lowerPrompt.startsWith('todo') ||
      lowerPrompt.startsWith('remind me')
    ) {
      const title =
        userPrompt
          .replace(/^(add task|create task|remind me to|task:|todo:)\s+/i, '')
          .trim() || 'New priority action item';
      const isUrgent = lowerPrompt.includes('urgent') || lowerPrompt.includes('asap');
      const params = { title, priority: isUrgent ? 'URGENT' : 'MEDIUM' };
      const { requiresApproval, consequence } = evaluateConsequence('create_task', params);

      toolProposals.push({
        id: crypto.randomUUID(),
        toolName: 'create_task',
        parameters: params,
        consequence,
        requiresApproval,
        status: 'EXECUTED',
        createdAt: new Date().toISOString(),
      });

      reply = `Created task **"${title}"** with **${params.priority}** priority. It is now on your Tasks & Projects board.`;
    }
    // 13. Math Calculation & Evaluation
    else if (this.isMathExpression(userPrompt)) {
      reply = this.evaluateMath(userPrompt);
    }
    // 14. Code Generation Request
    else if (this.isCodeRequest(userPrompt)) {
      reply = this.generateCodeSnippet(userPrompt);
    }
    // 15. Multi-Source Knowledge & Web Search Queries
    else if (
      lowerPrompt.includes('search') ||
      lowerPrompt.includes('google') ||
      lowerPrompt.includes('look up') ||
      lowerPrompt.includes('news') ||
      lowerPrompt.includes('latest') ||
      lowerPrompt.includes('weather') ||
      userPrompt.endsWith('?') ||
      /^(who|what|when|where|why|how|explain|define|tell)\b/i.test(lowerPrompt)
    ) {
      const cleanQuery =
        userPrompt
          .replace(
            /^(search for|search google for|google|search|look up|can you search|tell me about|what is the latest on)\s+/i,
            ''
          )
          .trim() || userPrompt;

      try {
        const results = this.customSearchProvider
          ? await this.customSearchProvider.search(cleanQuery, 5, true)
          : await this.knowledgeEngine.search(cleanQuery, 5);
        citations.push(...results);

        if (lowerPrompt.includes('search') || lowerPrompt.includes('google') || lowerPrompt.includes('look up')) {
          const params = { query: cleanQuery };
          const { requiresApproval, consequence } = evaluateConsequence('web_search', params);
          toolProposals.push({
            id: crypto.randomUUID(),
            toolName: 'web_search',
            parameters: params,
            consequence,
            requiresApproval,
            status: 'EXECUTED',
            createdAt: new Date().toISOString(),
          });
        }

        if (results.length > 0) {
          if (isDetailed) {
            const formattedSources = results
              .map((r, i) => `**${i + 1}. [${r.title}](${r.url})**${r.sourceName ? ` (${r.sourceName})` : ''}\n${r.snippet}`)
              .join('\n\n');
            reply = `Here are the verified multi-source findings for **"${cleanQuery}"**:\n\n${formattedSources}`;
          } else {
            const top = results[0];
            const sourceLabel = top.sourceName ? ` (${top.sourceName})` : '';
            reply = `${top.snippet} [Source: ${top.title}${sourceLabel}].`;
          }
        } else {
          reply = `I queried Wikipedia, DuckDuckGo, arXiv, StackExchange, GitHub, and Google News for "${cleanQuery}", but no live records were returned.`;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        reply = `Live knowledge lookup for "${cleanQuery}" failed: ${msg}.`;
      }
    }
    // 16. Conversational Fallback
    else {
      reply = this.generateConversationalResponse(userPrompt);
    }

    const finalReply = enforceShortAnswerFirst(reply, userPrompt);

    return {
      reply: finalReply,
      toolProposals,
      usedMemories,
      citations,
      uncertaintyNotes: citations.length > 0 ? 'Multi-source citations attached from verified live endpoints.' : undefined,
    };
  }

  private extractWebsiteUrl(prompt: string): string | null {
    const urlMatch = prompt.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      return urlMatch[0].replace(/[.,;!?]+$/, '');
    }

    const domainMatch = prompt.match(
      /\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|io|dev|ai|edu|gov|co|app|me|tv|in|uk)(?:\/[^\s]*)?)\b/i
    );
    if (domainMatch) {
      return `https://${domainMatch[1].replace(/[.,;!?]+$/, '')}`;
    }

    const lower = prompt.toLowerCase();
    for (const [siteKey, siteUrl] of Object.entries(KNOWN_WEBSITE_MAP)) {
      const escaped = siteKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`, 'i').test(lower)) {
        return siteUrl;
      }
    }

    return null;
  }

  private extractWhatsAppContact(prompt: string): string {
    const cleaned = prompt
      .replace(/\b(please|can you|could you|initiate|place|make|start|a|on|via|whatsapp|video|voice|call)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned || 'Contact';
  }

  private extractWhatsAppDocQuery(prompt: string): string {
    const cleaned = prompt
      .replace(
        /\b(please|can you|could you|search|find|download|open|get|fetch|for|the|a|an|on|in|from|and|whatsapp|document|file)\b/gi,
        ' '
      )
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned || 'document';
  }

  private detectEdgeBrowserAction(
    lowerPrompt: string
  ): { toolName: AllowedToolName; params: Record<string, unknown>; reply: string } | null {
    if (/\b(list|show|get)\s+(open\s+)?tabs\b/i.test(lowerPrompt)) {
      return {
        toolName: 'list_open_tabs',
        params: {},
        reply: 'Requested the list of currently open Microsoft Edge tabs.',
      };
    }

    if (/\bswitch\s+(?:to\s+)?tab\b/i.test(lowerPrompt)) {
      const match = lowerPrompt.replace(/^.*\bswitch\s+(?:to\s+)?tab\s*(?:to\s+)?/i, '').trim();
      return {
        toolName: 'switch_tab',
        params: { titleOrUrlMatch: match || 'active' },
        reply: `Switching Microsoft Edge to the tab matching "${match || 'active'}".`,
      };
    }

    if (/\b(read|summarize|summary)\s+(?:of\s+)?(?:the\s+)?active\s+(?:page|tab)\b/i.test(lowerPrompt)) {
      return {
        toolName: 'read_active_page_summary',
        params: { maxChars: 4000 },
        reply: 'Reading a summary of the active Microsoft Edge page.',
      };
    }

    if (/\b(pause|play|resume|mute|unmute|next|previous)\s+(?:media|video|audio|music|youtube|tab)\b/i.test(lowerPrompt)) {
      let command: 'PLAY' | 'PAUSE' | 'TOGGLE' | 'NEXT' | 'PREVIOUS' | 'MUTE' | 'UNMUTE' = 'TOGGLE';
      if (lowerPrompt.includes('pause')) command = 'PAUSE';
      else if (lowerPrompt.includes('play') || lowerPrompt.includes('resume')) command = 'PLAY';
      else if (lowerPrompt.includes('unmute')) command = 'UNMUTE';
      else if (lowerPrompt.includes('mute')) command = 'MUTE';
      else if (lowerPrompt.includes('next')) command = 'NEXT';
      else if (lowerPrompt.includes('previous')) command = 'PREVIOUS';

      return {
        toolName: 'media_control',
        params: { command },
        reply: `Prepared a Microsoft Edge media control command (**${command}**). Approve to execute on the active media tab.`,
      };
    }

    return null;
  }

  private isDesktopAppLaunchIntent(lowerPrompt: string): boolean {
    if (
      lowerPrompt.includes('open app') ||
      lowerPrompt.includes('launch') ||
      lowerPrompt.includes('calculator') ||
      lowerPrompt.includes('notepad') ||
      lowerPrompt.includes('terminal') ||
      lowerPrompt.includes('calc')
    ) {
      return true;
    }

    return /^(?:open|start)\s+[a-z0-9\s._-]+$/i.test(lowerPrompt.trim());
  }

  private resolveDesktopApp(
    prompt: string,
    context?: AIContext
  ): { appId?: string; appName: string; executablePath?: string } {
    const lower = prompt.toLowerCase();

    if (context?.allowlistedApps && context.allowlistedApps.length > 0) {
      for (const app of context.allowlistedApps) {
        if (lower.includes(app.appName.toLowerCase())) {
          return {
            appId: app.id,
            appName: app.appName,
            executablePath: app.executablePath,
          };
        }
      }
    }

    for (const alias of KNOWN_APP_ALIASES) {
      if (alias.keywords.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(lower))) {
        return { appName: alias.appName };
      }
    }

    const extracted = prompt
      .replace(/^(?:please\s+)?(?:open|launch|start)\s+(?:app\s+)?/i, '')
      .replace(/\s+app$/i, '')
      .trim();

    return {
      appName: extracted ? extracted.charAt(0).toUpperCase() + extracted.slice(1) : 'Calculator',
    };
  }

  private isCodeRequest(prompt: string): boolean {
    const lower = prompt.toLowerCase();
    const keywords = [
      'debounce',
      'throttle',
      'function',
      'write code',
      'write a script',
      'write a python',
      'write a typescript',
      'write a function',
      'create a function',
      'code snippet',
      'typescript code',
      'python script',
      'javascript function',
      'react component',
      'sql query',
      'algorithm',
      'regex',
      'binary search',
      'fibonacci',
      'sorting algorithm',
    ];
    return keywords.some((kw) => lower.includes(kw));
  }

  private isMathExpression(prompt: string): boolean {
    const clean = prompt.trim().toLowerCase();
    if (/^what\s+is\s+[\d\s+\-*/().%^]+$/i.test(clean)) return true;
    if (/^[\d\s+\-*/().%^]+$/.test(clean) && /[\d]/.test(clean) && /[+\-*/%]/.test(clean)) return true;
    if (/(\d+)\s*(plus|\+|-|minus|\*|times|multiplied by|\/|divided by)\s*(\d+)/i.test(clean)) return true;
    if (/(\d+)%\s+of\s+(\d+)/i.test(clean)) return true;
    if (/sqrt\(\d+\)/i.test(clean)) return true;
    return false;
  }

  private evaluateMath(prompt: string): string {
    try {
      const lower = prompt.toLowerCase();
      const pctMatch = lower.match(/(\d+(?:\.\d+)?)\s*%\s+of\s+(\d+(?:\.\d+)?)/);
      if (pctMatch) {
        const pct = parseFloat(pctMatch[1]);
        const total = parseFloat(pctMatch[2]);
        const result = (pct / 100) * total;
        return `${pct}% of ${total} equals **${result}**.`;
      }

      const sqrtMatch = lower.match(/sqrt\((\d+(?:\.\d+)?)\)/);
      if (sqrtMatch) {
        const val = parseFloat(sqrtMatch[1]);
        const result = Math.sqrt(val);
        return `√${val} equals **${result}**.`;
      }

      const expr = prompt
        .replace(/^(what is|calculate|solve|evaluate)\s*/i, '')
        .replace(/times|multiplied by/gi, '*')
        .replace(/divided by/gi, '/')
        .replace(/plus/gi, '+')
        .replace(/minus/gi, '-')
        .replace(/[^0-9+\-*/().]/g, '')
        .trim();

      if (expr) {
        const sanitized = expr.replace(/[^0-9+\-*/().]/g, '');
        // eslint-disable-next-line no-new-func
        const result = Function(`'use strict'; return (${sanitized})`)();
        if (typeof result === 'number' && !isNaN(result)) {
          return `\`${expr}\` equals **${result}**.`;
        }
      }
    } catch {
      // Evaluation syntax fallback
    }

    return `Please provide a clear arithmetic expression such as \`25 * 48\` or \`15% of 800\`.`;
  }

  private generateCodeSnippet(prompt: string): string {
    const lower = prompt.toLowerCase();

    if (lower.includes('debounce')) {
      return `Here is a typed TypeScript debounce implementation:\n\n\`\`\`typescript
export interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel: () => void;
  flush: () => void;
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number = 300,
  options: { leading?: boolean; trailing?: boolean } = { trailing: true }
): DebouncedFunction<T> {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debounced = (...args: Parameters<T>) => {
    lastArgs = args;
    const callNow = options.leading && !timerId;
    if (timerId) clearTimeout(timerId);
    timerId = setTimeout(() => {
      timerId = null;
      if (options.trailing && lastArgs) {
        fn(...lastArgs);
        lastArgs = null;
      }
    }, delayMs);
    if (callNow) fn(...args);
  };

  debounced.cancel = () => {
    if (timerId) clearTimeout(timerId);
    timerId = null;
    lastArgs = null;
  };

  debounced.flush = () => {
    if (timerId && lastArgs) {
      clearTimeout(timerId);
      timerId = null;
      fn(...lastArgs);
      lastArgs = null;
    }
  };

  return debounced;
}
\`\`\``;
    }

    if (lower.includes('throttle')) {
      return `Here is a TypeScript throttle implementation:\n\n\`\`\`typescript
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limitMs: number = 300
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;

  return function (...args: Parameters<T>) {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          fn(...lastArgs);
          lastArgs = null;
        }
      }, limitMs);
    } else {
      lastArgs = args;
    }
  };
}
\`\`\``;
    }

    if (lower.includes('python')) {
      return `Here is a Python HTTP helper:\n\n\`\`\`python
import requests
from typing import Dict, Any, Optional

def fetch_data(url: str, timeout: int = 10) -> Optional[Dict[str, Any]]:
    try:
        response = requests.get(url, timeout=timeout)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"Error fetching data from {url}: {e}")
        return None
\`\`\``;
    }

    return `Here is a TypeScript async helper:\n\n\`\`\`typescript
export async function executeOperation<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(endpoint, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) throw new Error(\`Operation failed with status \${response.status}\`);
  return response.json() as Promise<T>;
}
\`\`\``;
  }

  private generateConversationalResponse(prompt: string): string {
    const lower = prompt.toLowerCase();

    if (lower.includes('joke')) {
      return `Why do programmers prefer dark mode? Because light attracts bugs.`;
    }

    if (lower.includes('kill switch')) {
      return `The Stop All Automations Kill Switch immediately terminates active automations, aborts in-flight tools, and locks device relays until cleared.`;
    }

    if (lower.includes('android') || lower.includes('phone')) {
      return `DON's Android Companion communicates over encrypted local mDNS or cloud relay, and direct calls always require explicit phone-side approval.`;
    }

    return `Received: "${prompt}". Ask me to search live knowledge sources, open a site in Microsoft Edge, launch a Windows app, or handle WhatsApp documents and calls.`;
  }
}
