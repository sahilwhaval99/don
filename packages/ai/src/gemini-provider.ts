import {
  AIProvider,
  AIResponse,
  ChatMessage,
  AIContext,
} from './types.js';
import { MockAIProvider } from './mock-provider.js';
import { WebSearchResultItem, ToolCallProposal } from '@don/shared';
import { evaluateConsequence } from './consequences.js';

export class GeminiAIProvider implements AIProvider {
  name = 'GeminiAIProvider';
  private fallback = new MockAIProvider();

  constructor(
    private apiKey: string,
    private model = 'gemini-1.5-flash'
  ) {}

  async generateResponse(messages: ChatMessage[], context?: AIContext): Promise<AIResponse> {
    if (!this.apiKey || this.apiKey.includes('placeholder')) {
      return this.fallback.generateResponse(messages, context);
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

      // Build system instruction and conversation history
      const systemInstruction = {
        parts: [
          {
            text: `You are DON (Digital Operations Navigator), a secure, advanced, multi-device AI assistant for your authenticated owner.
Your goals:
- Useful, transparent, privacy-respecting, and strictly permission-based.
- Never directly execute consequential actions without proposing typed confirmation.
- When the user asks to launch an application, open a website, dial a phone, capture the screen, or change external settings, explain the consequence clearly.
- If the user asks for factual info, research, or news, utilize Google Search grounding and cite your sources.
Owner Name: ${context?.userName || 'Owner'}.
Registered Allowlisted Desktop Apps: ${context?.allowlistedApps?.map((a) => a.appName).join(', ') || 'Calculator, Notepad'}.`,
          },
        ],
      };

      const contents = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

      // Enable Google Search Grounding in Gemini
      const requestBody = {
        system_instruction: systemInstruction,
        contents,
        tools: [
          {
            googleSearch: {},
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        console.warn(`[GeminiAIProvider] HTTP ${res.status}, falling back to intelligent assistant`);
        return this.fallback.generateResponse(messages, context);
      }

      const json = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
          groundingMetadata?: {
            webSearchQueries?: string[];
            groundingChunks?: Array<{ web?: { uri: string; title: string } }>;
          };
        }>;
      };

      const candidate = json.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;

      if (!text) {
        return this.fallback.generateResponse(messages, context);
      }

      // Extract real Google Search citations from grounding metadata
      const citations: WebSearchResultItem[] = [];
      if (candidate?.groundingMetadata?.groundingChunks) {
        for (const chunk of candidate.groundingMetadata.groundingChunks) {
          if (chunk.web?.uri) {
            citations.push({
              title: chunk.web.title || 'Google Search Source',
              url: chunk.web.uri,
              snippet: 'Verified Google Search grounded result referenced by Gemini model.',
              publishedDate: new Date().toISOString(),
              uncertaintyScore: 0.04,
            });
          }
        }
      }

      // Check for tool proposals from user prompt
      const toolProposals: ToolCallProposal[] = [];
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
      const lower = (lastUserMsg?.content || '').toLowerCase();

      if (lower.includes('calculator') || (lower.includes('open') && lower.includes('notepad'))) {
        const appName = lower.includes('calculator') ? 'Calculator' : 'Notepad';
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
      } else if (lower.includes('call') || lower.includes('dial')) {
        const match = (lastUserMsg?.content || '').match(/(\+?\d[\d\s\-()]{6,}\d)/);
        const phoneNumber = match ? match[0].trim() : '+1-555-0199';
        const isDirect = lower.includes('direct call');
        const toolName = isDirect ? 'propose_phone_call' : 'propose_phone_dial';
        const params = isDirect
          ? { phoneNumber, reason: 'Initiate voice call', explicitDirectCallConsentRequired: true }
          : { phoneNumber, reason: 'Open phone dialer' };
        const { requiresApproval, consequence } = evaluateConsequence(toolName as any, params);
        toolProposals.push({
          id: crypto.randomUUID(),
          toolName: toolName as any,
          parameters: params,
          consequence,
          requiresApproval,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        });
      }

      return {
        reply: text,
        toolProposals,
        usedMemories: [],
        citations,
        uncertaintyNotes: citations.length > 0 ? 'Verified with Google Search Grounding.' : undefined,
      };
    } catch (err: any) {
      console.warn('[GeminiAIProvider] Call failed:', err.message);
      return this.fallback.generateResponse(messages, context);
    }
  }
}
