import { Document, DocumentSnippetCitation, DocumentSearchResponse } from '@don/shared';

export interface DocumentIndexedChunk {
  documentId: string;
  documentName: string;
  section: string;
  text: string;
}

export class DocumentRAGAnalyzer {
  private chunks: DocumentIndexedChunk[] = [];

  indexDocuments(documents: Document[]): void {
    this.chunks = [];
    for (const doc of documents) {
      // Split text into semantic chunks (~200 words or by paragraphs)
      const paragraphs = doc.rawText.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
      paragraphs.forEach((p, index) => {
        this.chunks.push({
          documentId: doc.id,
          documentName: doc.name,
          section: `Section ${index + 1}`,
          text: p.trim(),
        });
      });
    }
  }

  searchAndAnswer(question: string, topK = 3): DocumentSearchResponse {
    if (this.chunks.length === 0) {
      return {
        answer: 'No connected documents are currently available to answer this inquiry. Please upload or connect a document first.',
        citations: [],
        uncertaintyNotes: 'No knowledge base indexed.',
      };
    }

    const STOP_WORDS = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'to', 'for', 'of', 'or', 'by', 'with', 'from', 'what', 'how', 'who', 'where', 'when', 'why', 'can']);
    const qTokens = question
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    const scoredChunks = this.chunks.map((chunk) => {
      const chunkLower = chunk.text.toLowerCase();
      let matchCount = 0;
      for (const token of qTokens) {
        if (chunkLower.includes(token)) matchCount++;
      }
      const score = qTokens.length > 0 ? matchCount / qTokens.length : 0;
      return { chunk, score };
    });

    scoredChunks.sort((a, b) => b.score - a.score);
    const topMatches = scoredChunks.slice(0, topK).filter((m) => m.score > 0);

    if (topMatches.length === 0) {
      return {
        answer: `I could not locate an authoritative answer to "${question}" in your connected documents.`,
        citations: [],
        uncertaintyNotes: 'Zero lexical match with current documents.',
      };
    }

    const citations: DocumentSnippetCitation[] = topMatches.map((m) => ({
      documentId: m.chunk.documentId,
      documentName: m.chunk.documentName,
      pageOrSection: m.chunk.section,
      retrievalConfidence: Math.min(1.0, Math.max(0.2, Number((m.score * 0.9 + 0.1).toFixed(2)))),
      snippet: m.chunk.text.length > 220 ? m.chunk.text.substring(0, 220) + '...' : m.chunk.text,
    }));

    const synthesizedAnswer = `Based on your connected document "${topMatches[0].chunk.documentName}" (${topMatches[0].chunk.section}): ${topMatches[0].chunk.text}`;

    return {
      answer: synthesizedAnswer,
      citations,
      uncertaintyNotes:
        topMatches[0].score < 0.5
          ? 'Confidence is moderate; verify details against the original document citation.'
          : undefined,
    };
  }
}
