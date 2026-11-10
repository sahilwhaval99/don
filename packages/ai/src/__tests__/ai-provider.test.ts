import { describe, it, expect } from 'vitest';
import { MockAIProvider } from '../mock-provider.js';
import { ChatMessage } from '../types.js';

describe('MockAIProvider', () => {
  const provider = new MockAIProvider();

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
});
