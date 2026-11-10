import {
  AllowedToolName,
  ToolCallProposal,
  WebSearchResultItem,
  DocumentSnippetCitation,
} from '@don/shared';
import { AIProvider, AIResponse, ChatMessage, AIContext } from './types.js';
import { evaluateConsequence } from './consequences.js';
import { MockSearchProvider } from './search-provider.js';
import { DocumentRAGAnalyzer } from './document-rag.js';

export class MockAIProvider implements AIProvider {
  name = 'MockDeterministicAIProvider';
  private searchProvider = new MockSearchProvider();
  private docAnalyzer = new DocumentRAGAnalyzer();

  async generateResponse(messages: ChatMessage[], context?: AIContext): Promise<AIResponse> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    const userPrompt = lastUserMessage?.content || '';
    const lowerPrompt = userPrompt.toLowerCase();

    const toolProposals: ToolCallProposal[] = [];
    let reply = '';
    const citations: (WebSearchResultItem | DocumentSnippetCitation)[] = [];
    const usedMemories: Array<{ memoryId: string; key: string; reasonUsed: string }> = [];

    // Check if relevant memories exist in context
    if (context?.recentMemories && context.recentMemories.length > 0) {
      for (const mem of context.recentMemories) {
        if (lowerPrompt.includes(mem.key.toLowerCase()) || lowerPrompt.includes('preference') || lowerPrompt.includes('routine')) {
          usedMemories.push({
            memoryId: mem.id,
            key: mem.key,
            reasonUsed: `Recalled stored preference: "${mem.key}" to personalize response.`,
          });
        }
      }
    }

    // 1. Phone Call or Dialer Intent
    if (lowerPrompt.includes('call') || lowerPrompt.includes('dial')) {
      const phoneMatch = userPrompt.match(/(\+?\d[\d\s\-()]{6,}\d)/);
      const phoneNumber = phoneMatch ? phoneMatch[0].trim() : '+1-555-0199';
      const isDirectCall = lowerPrompt.includes('direct call') || lowerPrompt.includes('place a call');

      const toolName: AllowedToolName = isDirectCall ? 'propose_phone_call' : 'propose_phone_dial';
      const params = isDirectCall
        ? { phoneNumber, reason: 'Initiate voice call to contact', explicitDirectCallConsentRequired: true }
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
        ? `I have prepared a proposal to initiate an outgoing phone call to ${phoneNumber}. Direct calling requires your explicit approval on your paired Android device.`
        : `I have prepared a proposal to open the phone dialer with ${phoneNumber} on your paired Android phone.`;
    }
    // 2. Desktop App Intent
    else if (lowerPrompt.includes('open app') || lowerPrompt.includes('launch') || lowerPrompt.includes('open calculator') || lowerPrompt.includes('open notepad')) {
      const appName = lowerPrompt.includes('calculator')
        ? 'Calculator'
        : lowerPrompt.includes('notepad')
        ? 'Notepad'
        : 'Terminal';
      const params = { appName, reason: `Requested to open ${appName}` };
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

      reply = `I have submitted an approval request to open "${appName}" via your local Windows desktop agent. Action will not execute until you confirm.`;
    }
    // 3. Screen Capture Intent
    else if (lowerPrompt.includes('screen') || lowerPrompt.includes('capture') || lowerPrompt.includes('what is on my screen')) {
      const params = { windowTitleOrTarget: 'Active Workspace Window', purpose: 'Analyze current display for user troubleshooting' };
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

      reply = 'I have requested permission to capture a transient screenshot of your active window. No screen data will be inspected until approved.';
    }
    // 4. Web Search Intent
    else if (lowerPrompt.includes('search') || lowerPrompt.includes('look up') || lowerPrompt.includes('who is') || lowerPrompt.includes('what is')) {
      const searchQuery = userPrompt.replace(/^(search for|search|look up|what is|who is)\s+/i, '').trim() || userPrompt;
      const searchResults = await this.searchProvider.search(searchQuery, 3);
      citations.push(...searchResults);

      const params = { query: searchQuery };
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

      reply = `Here is what I found regarding "${searchQuery}":\n\n${searchResults.map((r) => `• [${r.title}](${r.url}): ${r.snippet}`).join('\n\n')}\n\nSources verified with publication dates.`;
    }
    // 5. Document Query Intent
    else if (lowerPrompt.includes('document') || lowerPrompt.includes('summary of pdf') || lowerPrompt.includes('file')) {
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
        reply = 'You currently have no connected documents uploaded. Connect a document in the Knowledge Center to enable verified document queries.';
      }
    }
    // 6. Task / Goal Intent
    else if (lowerPrompt.includes('task') || lowerPrompt.includes('todo') || lowerPrompt.includes('remind me')) {
      const title = userPrompt.replace(/^(create task|add task|remind me to|task:)\s+/i, '').trim() || 'New priority action item';
      const params = { title, priority: lowerPrompt.includes('urgent') ? 'URGENT' : 'MEDIUM' };
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

      reply = `I have created the task "${title}" with priority ${params.priority}.`;
    }
    // Default conversational response
    else {
      reply = `DON is ready. How can I assist you with your operations today? You can manage tasks, search verified sources, review routines, or interact with connected devices.`;
    }

    return {
      reply,
      toolProposals,
      usedMemories,
      citations,
      uncertaintyNotes: citations.length === 0 ? undefined : 'Citations attached from trusted sources.',
    };
  }
}
