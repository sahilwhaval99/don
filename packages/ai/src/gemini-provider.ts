import { AIProvider, AIResponse, ChatMessage, AIContext } from './types.js';
import { MockAIProvider } from './mock-provider.js';

export class GeminiAIProvider implements AIProvider {
  name = 'GeminiAIProvider';
  private apiKey: string;
  private fallback = new MockAIProvider();

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateResponse(messages: ChatMessage[], context?: AIContext): Promise<AIResponse> {
    if (!this.apiKey || this.apiKey.includes('placeholder')) {
      return this.fallback.generateResponse(messages, context);
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
      const contents = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (!res.ok) {
        return this.fallback.generateResponse(messages, context);
      }

      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        return this.fallback.generateResponse(messages, context);
      }

      return {
        reply: text,
        toolProposals: [],
        usedMemories: [],
        citations: [],
      };
    } catch {
      return this.fallback.generateResponse(messages, context);
    }
  }
}
