import { describe, it, expect } from 'vitest';
import { DocumentRAGAnalyzer } from '../document-rag.js';

describe('DocumentRAGAnalyzer', () => {
  const analyzer = new DocumentRAGAnalyzer();

  const mockDocuments = [
    {
      id: 'doc-security-01',
      userId: 'user-test',
      name: 'Security_Protocols.pdf',
      fileType: 'PDF' as const,
      sizeBytes: 1024,
      pageCount: 3,
      rawText:
        'Section 1: Access Control Guidelines.\nAll production access requires multi-factor authentication with short-lived session tokens and refresh token rotation.\n\nSection 2: Emergency Response Protocol.\nIn the event of an anomaly, the operator must trigger the Emergency Kill Switch to sever all active automation relays immediately.',
      summary: 'Security Protocols document covering access control and kill switch.',
      tags: ['security', 'compliance'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  it('returns clean fallback message when no documents are indexed', () => {
    const unindexedAnalyzer = new DocumentRAGAnalyzer();
    const result = unindexedAnalyzer.searchAndAnswer('What is the authentication policy?');
    expect(result.answer).toContain('No connected documents are currently available');
    expect(result.citations).toHaveLength(0);
  });

  it('indexes documents and returns verified answer with structured citation', () => {
    analyzer.indexDocuments(mockDocuments);
    const result = analyzer.searchAndAnswer('What is the emergency response protocol and kill switch?');

    expect(result.answer).toContain('Emergency Kill Switch');
    expect(result.citations.length).toBeGreaterThan(0);
    const cite = result.citations[0];
    expect(cite.documentName).toBe('Security_Protocols.pdf');
    expect(cite.pageOrSection).toContain('Section 2');
    expect(cite.retrievalConfidence).toBeGreaterThan(0.5);
    expect(cite.snippet).toContain('Emergency Kill Switch');
  });

  it('gracefully handles questions with no matching document content', () => {
    analyzer.indexDocuments(mockDocuments);
    const result = analyzer.searchAndAnswer('What is the recipe for chocolate chip cookies?');
    expect(result.answer).toContain('could not locate an authoritative answer');
    expect(result.citations).toHaveLength(0);
  });
});
