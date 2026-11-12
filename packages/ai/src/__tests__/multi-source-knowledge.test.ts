import { describe, it, expect } from 'vitest';
import { MultiSourceKnowledgeEngine } from '../multi-source-knowledge.js';

describe('MultiSourceKnowledgeEngine', () => {
  it('queries all 6 sources in parallel and deduplicates results', async () => {
    const mockFetch: typeof fetch = async (input) => {
      const url = String(input);

      if (url.includes('wikipedia.org/api/rest_v1/page/summary')) {
        return new Response(
          JSON.stringify({
            title: 'Quantum computing',
            extract: 'Quantum computing uses quantum-mechanical phenomena.',
            content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Quantum_computing' } },
          }),
          { status: 200 }
        );
      }

      if (url.includes('wikipedia.org/w/api.php')) {
        return new Response(
          JSON.stringify({
            query: {
              search: [
                {
                  title: 'Quantum computing',
                  snippet: 'Duplicate Wikipedia entry',
                },
              ],
            },
          }),
          { status: 200 }
        );
      }

      if (url.includes('api.duckduckgo.com')) {
        return new Response(
          JSON.stringify({
            Heading: 'Quantum Computing Overview',
            AbstractText: 'DuckDuckGo abstract on quantum computing.',
            AbstractURL: 'https://en.wikipedia.org/wiki/Quantum_computing/?utm_source=ddg',
          }),
          { status: 200 }
        );
      }

      if (url.includes('export.arxiv.org')) {
        return new Response(
          `<feed><entry><title>Quantum Algorithms Survey</title><id>https://arxiv.org/abs/2401.00001</id><summary>A survey of quantum algorithms.</summary><published>2024-01-01T00:00:00Z</published></entry></feed>`,
          { status: 200 }
        );
      }

      if (url.includes('api.stackexchange.com')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                title: 'How do quantum gates work?',
                link: 'https://stackoverflow.com/questions/12345/quantum-gates',
                score: 42,
                answer_count: 3,
                creation_date: 1700000000,
              },
            ],
          }),
          { status: 200 }
        );
      }

      if (url.includes('api.github.com')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                full_name: 'Qiskit/qiskit',
                html_url: 'https://github.com/Qiskit/qiskit',
                description: 'Open-source SDK for working with quantum computers',
                stargazers_count: 5000,
              },
            ],
          }),
          { status: 200 }
        );
      }

      if (url.includes('news.google.com/rss')) {
        return new Response(
          `<rss><channel><item><title>Quantum Breakthrough - Science Daily</title><link>https://news.google.com/articles/quantum1</link><pubDate>Mon, 01 Jan 2026 00:00:00 GMT</pubDate></item></channel></rss>`,
          { status: 200 }
        );
      }

      return new Response('', { status: 404 });
    };

    const engine = new MultiSourceKnowledgeEngine({ fetchFn: mockFetch, timeoutMs: 2000 });
    const result = await engine.query('quantum computing', { maxResults: 10 });

    expect(result.sourcesQueried).toHaveLength(6);
    expect(result.sourcesSucceeded).toHaveLength(6);
    expect(result.errors).toHaveLength(0);

    // Wikipedia + DuckDuckGo pointing to same normalized URL should be deduplicated
    const wikiUrls = result.citations.filter((c) => c.url.includes('en.wikipedia.org/wiki/Quantum_computing'));
    expect(wikiUrls).toHaveLength(1);
    expect(result.citations.some((c) => c.source === 'ARXIV')).toBe(true);
    expect(result.citations.some((c) => c.source === 'STACKEXCHANGE')).toBe(true);
    expect(result.citations.some((c) => c.source === 'GITHUB')).toBe(true);
    expect(result.citations.some((c) => c.source === 'GOOGLE_LIVE_RSS')).toBe(true);
  });

  it('enforces timeout guards without blocking fast sources', async () => {
    const mockFetch: typeof fetch = (input, init) => {
      const url = String(input);
      if (url.includes('export.arxiv.org')) {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('Aborted due to timeout')));
        });
      }
      if (url.includes('api.github.com')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  full_name: 'microsoft/TypeScript',
                  html_url: 'https://github.com/microsoft/TypeScript',
                  description: 'TypeScript language',
                  stargazers_count: 100000,
                },
              ],
            }),
            { status: 200 }
          )
        );
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    };

    const engine = new MultiSourceKnowledgeEngine({ fetchFn: mockFetch, timeoutMs: 50 });
    const result = await engine.query('TypeScript', {
      sources: ['ARXIV', 'GITHUB'],
      timeoutMs: 50,
    });

    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].source).toBe('GITHUB');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].source).toBe('ARXIV');
  });

  it('returns zero fabricated citations when all sources fail or return empty', async () => {
    const failingFetch: typeof fetch = async () => {
      throw new Error('Network offline');
    };

    const engine = new MultiSourceKnowledgeEngine({ fetchFn: failingFetch, timeoutMs: 200 });
    const result = await engine.query('nonexistent offline query');

    expect(result.citations).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
