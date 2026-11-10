import { describe, it, expect } from 'vitest';
import { MockSearchProvider } from '../search-provider.js';

describe('Search Providers', () => {
  const provider = new MockSearchProvider();

  it('returns structured search results with url, title, snippet, and uncertainty score', async () => {
    const results = await provider.search('typescript', 2);
    expect(results).toHaveLength(2);
    expect(results[0].title).toContain('TypeScript');
    expect(results[0].url).toContain('typescriptlang.org');
    expect(results[0].snippet).toBeTruthy();
    expect(results[0].uncertaintyScore).toBeLessThan(0.2);
  });

  it('filters results by domain allowlist', async () => {
    const results = await provider.search('typescript', 5, true, {
      domainAllowlist: ['devblogs.microsoft.com'],
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.url.includes('devblogs.microsoft.com'))).toBe(true);
  });

  it('filters results by domain blocklist', async () => {
    const results = await provider.search('typescript', 5, true, {
      domainBlocklist: ['typescriptlang.org'],
    });
    expect(results.every((r) => !r.url.includes('typescriptlang.org'))).toBe(true);
  });
});
