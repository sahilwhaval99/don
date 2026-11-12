import { describe, it, expect } from 'vitest';
import { MockAIProvider } from '../mock-provider.js';
import { MultiSourceKnowledgeEngine } from '../multi-source-knowledge.js';
import { enforceShortAnswerFirst } from '../jarvis-directive.js';
import { ChatMessage } from '../types.js';

describe('MockAIProvider', () => {
  const mockEngine = new MultiSourceKnowledgeEngine({
    fetchFn: async (input) => {
      const url = String(input);
      if (url.includes('wikipedia.org/api/rest_v1/page/summary')) {
        return new Response(
          JSON.stringify({
            title: 'Quantum computing',
            extract: 'Quantum computing harnesses superposition and entanglement to solve complex problems.',
            content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Quantum_computing' } },
          }),
          { status: 200 }
        );
      }
      return new Response('{}', { status: 200 });
    },
  });
  const provider = new MockAIProvider({ knowledgeEngine: mockEngine });

  it('proposes phone dial with explicit approval required', async () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Please call +1-555-0144', createdAt: new Date().toISOString() },
    ];
    const res = await provider.generateResponse(messages);
    expect(res.toolProposals.length).toBeGreaterThan(0);
    const dialProposal = res.toolProposals[0];
    expect(dialProposal.toolName).toBe('propose_phone_dial');
    expect(dialProposal.requiresApproval).toBe(true);
    expect(dialProposal.consequence.requiresAndroidCompanion).toBe(true);
  });

  it('proposes desktop app launch with user confirmation requirement', async () => {
    const messages: ChatMessage[] = [
      { id: '2', role: 'user', content: 'Open calculator app', createdAt: new Date().toISOString() },
    ];
    const res = await provider.generateResponse(messages);
    expect(res.toolProposals.length).toBeGreaterThan(0);
    const appProposal = res.toolProposals[0];
    expect(appProposal.toolName).toBe('propose_open_desktop_app');
    expect(appProposal.requiresApproval).toBe(true);
    expect(appProposal.consequence.requiresLocalAgent).toBe(true);
  });

  it('returns web search citations for search query', async () => {
    const messages: ChatMessage[] = [
      { id: '3', role: 'user', content: 'search for quantum computing breakthrough', createdAt: new Date().toISOString() },
    ];
    const res = await provider.generateResponse(messages);
    expect(res.citations.length).toBeGreaterThan(0);
    const firstCite = res.citations[0];
    expect(firstCite).toHaveProperty('url');
    expect(firstCite).toHaveProperty('title');
  });

  it('answers conversational prompt cleanly without phantom tool executions', async () => {
    const messages: ChatMessage[] = [
      { id: '4', role: 'user', content: 'Hello DON, how are you today?', createdAt: new Date().toISOString() },
    ];
    const res = await provider.generateResponse(messages);
    expect(res.reply).toContain('DON is ready');
    expect(res.toolProposals.length).toBe(0);
  });

  it('routes website opening to Microsoft Edge (open youtube, open github.com)', async () => {
    const ytRes = await provider.generateResponse([
      { id: '5', role: 'user', content: 'open youtube', createdAt: new Date().toISOString() },
    ]);
    expect(ytRes.toolProposals[0].toolName).toBe('propose_open_website');
    expect(ytRes.toolProposals[0].parameters.url).toBe('https://www.youtube.com');
    expect(ytRes.toolProposals[0].parameters.browser).toBe('msedge');

    const ghRes = await provider.generateResponse([
      { id: '6', role: 'user', content: 'open github.com', createdAt: new Date().toISOString() },
    ]);
    expect(ghRes.toolProposals[0].toolName).toBe('propose_open_website');
    expect(ghRes.toolProposals[0].parameters.url).toBe('https://github.com');
  });

  it('routes any Windows app launch request', async () => {
    const res = await provider.generateResponse([
      { id: '7', role: 'user', content: 'open spotify', createdAt: new Date().toISOString() },
    ]);
    expect(res.toolProposals[0].toolName).toBe('propose_open_desktop_app');
    expect(res.toolProposals[0].parameters.appName).toBe('Spotify');
  });

  it('routes WhatsApp document search/download/open and WhatsApp call intents', async () => {
    const docRes = await provider.generateResponse([
      { id: '8', role: 'user', content: 'search syllabus on whatsapp', createdAt: new Date().toISOString() },
    ]);
    expect(docRes.toolProposals[0].toolName).toBe('whatsapp_search_download_open');
    expect(docRes.toolProposals[0].parameters.query).toBe('syllabus');

    const callRes = await provider.generateResponse([
      { id: '9', role: 'user', content: 'call Mom on whatsapp', createdAt: new Date().toISOString() },
    ]);
    expect(callRes.toolProposals[0].toolName).toBe('whatsapp_call');
    expect(callRes.toolProposals[0].parameters.contactName).toBe('Mom');
  });

  it('routes Edge browser tab and media control intents', async () => {
    const tabsRes = await provider.generateResponse([
      { id: '10', role: 'user', content: 'list open tabs', createdAt: new Date().toISOString() },
    ]);
    expect(tabsRes.toolProposals[0].toolName).toBe('list_open_tabs');

    const mediaRes = await provider.generateResponse([
      { id: '11', role: 'user', content: 'pause media', createdAt: new Date().toISOString() },
    ]);
    expect(mediaRes.toolProposals[0].toolName).toBe('media_control');
    expect(mediaRes.toolProposals[0].parameters.command).toBe('PAUSE');
  });

  it('enforces Short-Answer-First J.A.R.V.I.S. directive (1-3 sentences by default, longer when detailed)', () => {
    const longText = 'Sentence one. Sentence two. Sentence three. Sentence four. Sentence five.';
    const short = enforceShortAnswerFirst(longText, 'What is TypeScript?');
    expect(short).toBe('Sentence one. Sentence two. Sentence three.');

    const detailed = enforceShortAnswerFirst(longText, 'Explain TypeScript in depth');
    expect(detailed).toBe(longText);
  });
});
