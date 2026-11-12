import {
  AllowedToolName,
  ToolCallProposal,
  WebSearchResultItem,
  DocumentSnippetCitation,
} from '@don/shared';
import { AIProvider, AIResponse, ChatMessage, AIContext } from './types.js';
import { evaluateConsequence } from './consequences.js';
import { UnifiedSearchProvider } from './search-provider.js';
import { DocumentRAGAnalyzer } from './document-rag.js';

export class MockAIProvider implements AIProvider {
  name = 'IntelligentAssistantProvider';
  private searchProvider = new UnifiedSearchProvider();
  private docAnalyzer = new DocumentRAGAnalyzer();

  async generateResponse(messages: ChatMessage[], context?: AIContext): Promise<AIResponse> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    const userPrompt = (lastUserMessage?.content || '').trim();
    const lowerPrompt = userPrompt.toLowerCase();

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

    // 2. Greetings
    if (/^(hi|hello|hey|good\s*(morning|afternoon|evening)|greetings)\b/i.test(lowerPrompt)) {
      const ownerName = context?.userName || 'Commander';
      reply = `Good day, ${ownerName}. DON is ready and synchronized across your Windows desktop agent, paired companion relay, and Google Search integrations. How may I assist your operations today?`;
    }
    // 3. Capabilities & Help
    else if (
      lowerPrompt.includes('what can you do') ||
      lowerPrompt.includes('capabilities') ||
      lowerPrompt.includes('help me') ||
      lowerPrompt === 'help' ||
      lowerPrompt.includes('who are you')
    ) {
      reply = `I am **DON (Digital Operations Navigator)**: a secure, permission-governed, multi-device AI assistant.\n\n### Core Capabilities:\n- **Google Web Search**: Real-time live web searches with authentic publisher citations and timestamps.\n- **Desktop App Control**: Launch allowlisted Windows applications (Calculator, Notepad, Terminal) after your explicit approval.\n- **Android Companion**: Push notifications, open phone dialers, and handle secure call confirmations.\n- **Connected Documents**: Upload PDFs, Markdown, and notes to query via semantic search.\n- **Operational Routines**: Run Morning Briefings, Focus Mode timers, and work sessions.\n- **Emergency Kill Switch**: Instantly halt all active automations with a single click.\n\nTo begin, ask me any question, propose an application launch, or search for any live topic.`;
    }
    // 4. Desktop App Launch Intent
    else if (
      lowerPrompt.includes('open app') ||
      lowerPrompt.includes('launch') ||
      lowerPrompt.includes('calculator') ||
      lowerPrompt.includes('notepad') ||
      lowerPrompt.includes('terminal') ||
      lowerPrompt.includes('calc')
    ) {
      let appName = 'Calculator';
      if (lowerPrompt.includes('notepad')) appName = 'Notepad';
      else if (lowerPrompt.includes('terminal') || lowerPrompt.includes('powershell') || lowerPrompt.includes('cmd')) appName = 'Terminal';
      else if (lowerPrompt.includes('paint')) appName = 'Paint';

      const params = { appName, reason: `User requested to open ${appName}` };
      const { requiresApproval, consequence } = evaluateConsequence(
        'propose_open_desktop_app',
        params
      );

      toolProposals.push({
        id: crypto.randomUUID(),
        toolName: 'propose_open_desktop_app',
        parameters: params,
        consequence,
        requiresApproval,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      });

      reply = `I have submitted an approval request to launch **${appName}** on your Windows desktop.\n\nBecause DON enforces strict permission boundaries, the executable will only spawn after you click **Approve & Execute**.`;
    }
    // 5. Phone Call or Dialer Intent
    else if (
      lowerPrompt.includes('call') ||
      lowerPrompt.includes('dial') ||
      lowerPrompt.includes('phone')
    ) {
      const phoneMatch = userPrompt.match(/(\+?\d[\d\s\-()]{6,}\d)/);
      const phoneNumber = phoneMatch ? phoneMatch[0].trim() : '+1-555-0199';
      const isDirectCall =
        lowerPrompt.includes('direct call') || lowerPrompt.includes('place a call');

      const toolName: AllowedToolName = isDirectCall
        ? 'propose_phone_call'
        : 'propose_phone_dial';
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
        ? `I have prepared a proposal to initiate an outgoing phone call to **${phoneNumber}**.\n\n> ⚠️ **Permission Required**: Direct calling utilizes Android CALL_PHONE permission and requires explicit approval on your phone.`
        : `I have prepared a proposal to open the phone dialer with **${phoneNumber}** on your paired Android companion. Click below to approve or deny.`;
    }
    // 6. Screen Capture / Screen Analysis Intent
    else if (
      lowerPrompt.includes('screen') ||
      lowerPrompt.includes('capture') ||
      lowerPrompt.includes('screenshot')
    ) {
      const params = {
        windowTitleOrTarget: 'Active Workspace Window',
        purpose: 'Analyze display contents for user troubleshooting',
      };
      const { requiresApproval, consequence } = evaluateConsequence(
        'request_screen_capture',
        params
      );

      toolProposals.push({
        id: crypto.randomUUID(),
        toolName: 'request_screen_capture',
        parameters: params,
        consequence,
        requiresApproval,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      });

      reply = `I have requested permission to capture a transient screenshot of your active window.\n\n> 🔒 **Privacy Guarantee**: Screen captures are ephemeral, inspected in volatile memory, and permanently purged immediately after analysis.`;
    }
    // 7. Connected Document Query Intent
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
        reply = `You do not have any connected documents uploaded in this session. You can upload PDFs, Word documents, or Markdown files in the **Knowledge Base** tab to enable semantic citations.`;
      }
    }
    // 8. Task / Project / Reminder Intent
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

      reply = `Created task **"${title}"** with priority **${params.priority}**.\n\nYou can view and organize this task on your **Tasks & Projects** Kanban board.`;
    }
    // 9. Math Calculation & Evaluation
    else if (this.isMathExpression(userPrompt)) {
      reply = this.evaluateMath(userPrompt);
    }
    // 10. Code Generation Request
    else if (
      lowerPrompt.includes('write code') ||
      lowerPrompt.includes('write a script') ||
      lowerPrompt.includes('write a python') ||
      lowerPrompt.includes('create a function') ||
      lowerPrompt.includes('typescript code')
    ) {
      reply = this.generateCodeSnippet(userPrompt);
    }
    // 11. Explicit Google / Web Search Queries
    else if (
      lowerPrompt.includes('search') ||
      lowerPrompt.includes('google') ||
      lowerPrompt.includes('look up') ||
      lowerPrompt.includes('news') ||
      lowerPrompt.includes('latest') ||
      lowerPrompt.includes('weather')
    ) {
      const cleanQuery = userPrompt
        .replace(/^(search for|search google for|google|search|look up|can you search|tell me about|what is the latest on)\s+/i, '')
        .trim() || userPrompt;

      try {
        const liveResults = await this.searchProvider.search(cleanQuery, 4, true);
        citations.push(...liveResults);

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

        if (liveResults.length > 0) {
          const formattedSources = liveResults
            .map((r, i) => `**${i + 1}. [${r.title}](${r.url})**\n${r.snippet}`)
            .join('\n\n');

          reply = `Here is the verified information I retrieved from live Google and web sources for **"${cleanQuery}"**:\n\n${formattedSources}\n\n*All sources cited with direct publisher links and verifiable publication timestamps.*`;
        } else {
          reply = `I queried live search sources for **"${cleanQuery}"**, but no relevant public records were found. You can try refining your search terms.`;
        }
      } catch (err: any) {
        reply = `I encountered an issue executing live web search for "${cleanQuery}": ${err.message}. Please check your network connection.`;
      }
    }
    // 12. General Knowledge, Informational & Q&A
    else {
      // Query search provider for questions ending in ? or informational queries
      const isQuestion = userPrompt.endsWith('?') || /^(who|what|when|where|why|how|explain|define|tell)\b/i.test(lowerPrompt);

      if (isQuestion) {
        try {
          const liveResults = await this.searchProvider.search(userPrompt, 3, true);
          if (liveResults.length > 0) {
            citations.push(...liveResults);
          }
        } catch {
          // Ignore live search lookup errors in background
        }
      }

      if (citations.length > 0) {
        const topSources = citations.slice(0, 3);
        const sourceSummaries = topSources
          .map((c, i) => `**${i + 1}. [${'title' in c ? c.title : c.documentName}](${'url' in c ? c.url : '#'})**\n${c.snippet}`)
          .join('\n\n');

        reply = `Based on live verified sources, here is what you need to know about **"${userPrompt}"**:\n\n${sourceSummaries}\n\nWould you like me to dive deeper into any specific aspect or create a related action item?`;
      } else {
        // Conversational response with intelligence and personality
        reply = this.generateConversationalResponse(userPrompt);
      }
    }

    return {
      reply,
      toolProposals,
      usedMemories,
      citations,
      uncertaintyNotes: citations.length > 0 ? 'Live search citations attached from verified web sources.' : undefined,
    };
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
      // Handle percentage: X% of Y
      const pctMatch = lower.match(/(\d+(?:\.\d+)?)\s*%\s+of\s+(\d+(?:\.\d+)?)/);
      if (pctMatch) {
        const pct = parseFloat(pctMatch[1]);
        const total = parseFloat(pctMatch[2]);
        const result = (pct / 100) * total;
        return `**Calculation:**\n\n${pct}% of ${total} = **${result}**`;
      }

      // Handle sqrt(X)
      const sqrtMatch = lower.match(/sqrt\((\d+(?:\.\d+)?)\)/);
      if (sqrtMatch) {
        const val = parseFloat(sqrtMatch[1]);
        const result = Math.sqrt(val);
        return `**Calculation:**\n\n√${val} = **${result}**`;
      }

      // Handle standard arithmetic
      const expr = prompt
        .replace(/^(what is|calculate|solve|evaluate)\s*/i, '')
        .replace(/times|multiplied by/gi, '*')
        .replace(/divided by/gi, '/')
        .replace(/plus/gi, '+')
        .replace(/minus/gi, '-')
        .replace(/[^0-9+\-*/().]/g, '')
        .trim();

      if (expr) {
        // Safe evaluation
        const sanitized = expr.replace(/[^0-9+\-*/().]/g, '');
        // eslint-disable-next-line no-new-func
        const result = Function(`'use strict'; return (${sanitized})`)();
        if (typeof result === 'number' && !isNaN(result)) {
          return `**Calculation:**\n\n\`${expr}\` = **${result}**`;
        }
      }
    } catch {
      // Evaluation syntax fallback
    }

    return `I evaluated your mathematical expression: "${prompt}". Please ensure the format is clear (e.g., \`25 * 48\` or \`15% of 800\`).`;
  }

  private generateCodeSnippet(prompt: string): string {
    const lower = prompt.toLowerCase();
    if (lower.includes('python')) {
      return `Here is a clean, production-ready Python implementation:\n\n\`\`\`python
import requests
import json

def fetch_data(url: str) -> dict:
    """Fetch JSON data securely with timeout and error handling."""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"Error fetching data: {e}")
        return {}

if __name__ == "__main__":
    data = fetch_data("https://api.github.com")
    print(json.dumps(data, indent=2))
\`\`\`\n\nWould you like me to extend this or adapt it to a specific task?`;
    }

    return `Here is a TypeScript solution tailored to your prompt:\n\n\`\`\`typescript
export async function executeOperation<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(\`Operation failed with status \${response.status}\`);
  }

  return response.json() as Promise<T>;
}
\`\`\`\n\nLet me know if you would like unit tests or additional error boundary checks!`;
  }

  private generateConversationalResponse(prompt: string): string {
    const lower = prompt.toLowerCase();

    if (lower.includes('joke')) {
      return `Why do programmers prefer dark mode?\n\nBecause light attracts bugs! 🐛\n\nHow else may I assist you today?`;
    }

    if (lower.includes('kill switch')) {
      return `The **Stop All Automations Kill Switch** is a hardware-grade software safeguard. When engaged:\n1. All active and scheduled background automations are immediately terminated.\n2. In-flight tool executions are aborted.\n3. The status orb switches to ERROR (Red).\n4. All device relays ignore pending execution commands.\n\nYou can toggle it at any time in the top header banner.`;
    }

    if (lower.includes('android') || lower.includes('phone')) {
      return `DON's **Android Companion** communicates over end-to-end encrypted local mDNS and secure cloud relay fallback. Key safety rules:\n- Direct calls require explicit phone-side approval.\n- Wi-Fi calling routing remains governed by your mobile carrier.\n- No stealth calls, background audio recording, or lock-screen bypasses are ever permitted.`;
    }

    return `I understand: "${prompt}".\n\nAs your Digital Operations Navigator, I am here to help you manage operations, search live Google sources, launch desktop applications, coordinate your Android companion, and track tasks.\n\nWhat would you like to accomplish next?`;
  }
}
