import {
  AllowedToolName,
  ToolCallProposal,
  WebSearchResultItem,
  DocumentSnippetCitation,
  MemoryCitation,
} from '@don/shared';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCallProposal[];
  citations?: (WebSearchResultItem | DocumentSnippetCitation | MemoryCitation)[];
  createdAt: string;
}

export interface AIContext {
  userId: string;
  userName?: string;
  userTimezone?: string;
  recentMemories?: Array<{ id: string; key: string; content: string }>;
  connectedDocuments?: Array<{ id: string; name: string; text: string }>;
  allowlistedApps?: Array<{ id: string; appName: string; executablePath: string }>;
  pairedDevices?: Array<{ id: string; name: string; type: string; status: string }>;
}

export interface AIResponse {
  reply: string;
  toolProposals: ToolCallProposal[];
  usedMemories: Array<{ memoryId: string; key: string; reasonUsed: string }>;
  citations: (WebSearchResultItem | DocumentSnippetCitation)[];
  uncertaintyNotes?: string;
}

export interface AIProvider {
  name: string;
  generateResponse(messages: ChatMessage[], context?: AIContext): Promise<AIResponse>;
}

export interface SearchProvider {
  name: string;
  search(query: string, maxResults?: number, safeSearch?: boolean): Promise<WebSearchResultItem[]>;
}
