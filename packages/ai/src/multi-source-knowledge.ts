import { KnowledgeSourceType, WebSearchResultItem } from '@don/shared';
import { SearchProvider } from './types.js';

export interface MultiSourceEngineConfig {
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export interface MultiSourceQueryOptions {
  maxResults?: number;
  timeoutMs?: number;
  sources?: KnowledgeSourceType[];
}

export interface MultiSourceQueryResult {
  query: string;
  citations: WebSearchResultItem[];
  sourcesQueried: KnowledgeSourceType[];
  sourcesSucceeded: KnowledgeSourceType[];
  errors: Array<{ source: KnowledgeSourceType; message: string }>;
}

const DEFAULT_SOURCES: KnowledgeSourceType[] = [
  'WIKIPEDIA',
  'DUCKDUCKGO',
  'ARXIV',
  'STACKEXCHANGE',
  'GITHUB',
  'GOOGLE_LIVE_RSS',
];

function decodeXmlEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&#x27;/g, "'")
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidHttpUrl(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function normalizeUrlForDedup(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (key.startsWith('utm_') || key === 'ref') {
        parsed.searchParams.delete(key);
      }
    }
    parsed.hash = '';
    const normalized = parsed.toString().replace(/\/+$/, '').toLowerCase();
    return normalized;
  } catch {
    return rawUrl.trim().toLowerCase().replace(/\/+$/, '');
  }
}

function normalizeTitleForDedup(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export class MultiSourceKnowledgeEngine implements SearchProvider {
  name = 'MultiSourceKnowledgeEngine';
  private timeoutMs: number;
  private fetchFn: typeof fetch;

  constructor(config?: MultiSourceEngineConfig) {
    this.timeoutMs = config?.timeoutMs ?? 4500;
    this.fetchFn = config?.fetchFn ?? globalThis.fetch;
  }

  async search(query: string, maxResults = 6): Promise<WebSearchResultItem[]> {
    const res = await this.query(query, { maxResults });
    return res.citations;
  }

  async query(query: string, options?: MultiSourceQueryOptions): Promise<MultiSourceQueryResult> {
    const cleanQuery = query.trim();
    const maxResults = options?.maxResults ?? 6;
    const timeoutMs = options?.timeoutMs ?? this.timeoutMs;
    const sources = options?.sources && options.sources.length > 0 ? options.sources : DEFAULT_SOURCES;

    if (!cleanQuery) {
      return {
        query: cleanQuery,
        citations: [],
        sourcesQueried: [],
        sourcesSucceeded: [],
        errors: [],
      };
    }

    const tasks = sources.map((source) =>
      this.querySingleSource(source, cleanQuery, timeoutMs)
        .then((items) => ({ source, items }))
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          throw { source, message };
        })
    );

    const settled = await Promise.allSettled(tasks);
    const collected: WebSearchResultItem[] = [];
    const sourcesSucceeded: KnowledgeSourceType[] = [];
    const errors: Array<{ source: KnowledgeSourceType; message: string }> = [];

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        sourcesSucceeded.push(result.value.source);
        collected.push(...result.value.items);
      } else {
        const reason = result.reason as { source?: KnowledgeSourceType; message?: string };
        errors.push({
          source: reason?.source ?? 'WEB',
          message: reason?.message ?? 'Source query failed',
        });
      }
    }

    const deduplicated = this.deduplicate(collected).slice(0, maxResults);

    return {
      query: cleanQuery,
      citations: deduplicated,
      sourcesQueried: sources,
      sourcesSucceeded,
      errors,
    };
  }

  private deduplicate(items: WebSearchResultItem[]): WebSearchResultItem[] {
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    const unique: WebSearchResultItem[] = [];

    for (const item of items) {
      if (!item.title?.trim() || !item.snippet?.trim() || !isValidHttpUrl(item.url)) {
        continue;
      }

      const normUrl = normalizeUrlForDedup(item.url);
      const normTitle = normalizeTitleForDedup(item.title);

      if (seenUrls.has(normUrl) || (normTitle && seenTitles.has(normTitle))) {
        continue;
      }

      seenUrls.add(normUrl);
      if (normTitle) seenTitles.add(normTitle);
      unique.push(item);
    }

    return unique;
  }

  private async fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await this.fetchFn(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private async querySingleSource(
    source: KnowledgeSourceType,
    query: string,
    timeoutMs: number
  ): Promise<WebSearchResultItem[]> {
    switch (source) {
      case 'WIKIPEDIA':
        return this.queryWikipedia(query, timeoutMs);
      case 'DUCKDUCKGO':
        return this.queryDuckDuckGo(query, timeoutMs);
      case 'ARXIV':
        return this.queryArxiv(query, timeoutMs);
      case 'STACKEXCHANGE':
        return this.queryStackExchange(query, timeoutMs);
      case 'GITHUB':
        return this.queryGitHub(query, timeoutMs);
      case 'GOOGLE_LIVE_RSS':
        return this.queryGoogleLiveRss(query, timeoutMs);
      default:
        return [];
    }
  }

  private async queryWikipedia(query: string, timeoutMs: number): Promise<WebSearchResultItem[]> {
    const results: WebSearchResultItem[] = [];
    const topicSlug = encodeURIComponent(query.replace(/\s+/g, '_'));
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${topicSlug}`;

    try {
      const summaryRes = await this.fetchWithTimeout(
        summaryUrl,
        { headers: { 'User-Agent': 'DON-AI-Assistant/2.0', Accept: 'application/json' } },
        timeoutMs
      );
      if (summaryRes.ok) {
        const data = (await summaryRes.json()) as {
          title?: string;
          extract?: string;
          content_urls?: { desktop?: { page?: string } };
          timestamp?: string;
          type?: string;
        };
        const pageUrl = data.content_urls?.desktop?.page;
        if (data.title && data.extract && isValidHttpUrl(pageUrl) && data.type !== 'disambiguation') {
          results.push({
            title: data.title,
            url: pageUrl,
            snippet: data.extract.trim(),
            publishedDate: data.timestamp || new Date().toISOString(),
            uncertaintyScore: 0.04,
            source: 'WIKIPEDIA',
            sourceName: 'Wikipedia',
          });
        }
      }
    } catch {
      // Fall through to Wikipedia Search API
    }

    if (results.length < 2) {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&srlimit=3`;
      const searchRes = await this.fetchWithTimeout(
        searchUrl,
        { headers: { 'User-Agent': 'DON-AI-Assistant/2.0', Accept: 'application/json' } },
        timeoutMs
      );
      if (searchRes.ok) {
        const searchData = (await searchRes.json()) as {
          query?: { search?: Array<{ title: string; snippet: string; timestamp?: string }> };
        };
        for (const item of searchData.query?.search ?? []) {
          const cleanSnippet = decodeXmlEntities(item.snippet);
          if (item.title && cleanSnippet) {
            results.push({
              title: item.title,
              url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/\s+/g, '_'))}`,
              snippet: cleanSnippet,
              publishedDate: item.timestamp || new Date().toISOString(),
              uncertaintyScore: 0.06,
              source: 'WIKIPEDIA',
              sourceName: 'Wikipedia',
            });
          }
        }
      }
    }

    return results;
  }

  private async queryDuckDuckGo(query: string, timeoutMs: number): Promise<WebSearchResultItem[]> {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await this.fetchWithTimeout(
      url,
      { headers: { 'User-Agent': 'DON-AI-Assistant/2.0', Accept: 'application/json' } },
      timeoutMs
    );
    if (!res.ok) return [];

    const data = (await res.json()) as {
      Heading?: string;
      AbstractText?: string;
      AbstractURL?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
    };

    const results: WebSearchResultItem[] = [];
    if (data.AbstractText && isValidHttpUrl(data.AbstractURL)) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL,
        snippet: data.AbstractText.trim(),
        publishedDate: new Date().toISOString(),
        uncertaintyScore: 0.07,
        source: 'DUCKDUCKGO',
        sourceName: 'DuckDuckGo Instant Answer',
      });
    }

    for (const topic of (data.RelatedTopics ?? []).slice(0, 2)) {
      if (topic.Text && isValidHttpUrl(topic.FirstURL)) {
        const title = topic.Text.split(' - ')[0]?.slice(0, 100) || query;
        results.push({
          title,
          url: topic.FirstURL,
          snippet: topic.Text.trim(),
          publishedDate: new Date().toISOString(),
          uncertaintyScore: 0.1,
          source: 'DUCKDUCKGO',
          sourceName: 'DuckDuckGo Instant Answer',
        });
      }
    }

    return results;
  }

  private async queryArxiv(query: string, timeoutMs: number): Promise<WebSearchResultItem[]> {
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=3`;
    const res = await this.fetchWithTimeout(
      url,
      { headers: { 'User-Agent': 'DON-AI-Assistant/2.0', Accept: 'application/atom+xml, text/xml' } },
      timeoutMs
    );
    if (!res.ok) return [];

    const xml = await res.text();
    const results: WebSearchResultItem[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match: RegExpExecArray | null;

    while ((match = entryRegex.exec(xml)) !== null && results.length < 3) {
      const entryXml = match[1];
      const titleMatch = entryXml.match(/<title>([\s\S]*?)<\/title>/);
      const idMatch = entryXml.match(/<id>([\s\S]*?)<\/id>/);
      const summaryMatch = entryXml.match(/<summary>([\s\S]*?)<\/summary>/);
      const publishedMatch = entryXml.match(/<published>([\s\S]*?)<\/published>/);

      const title = titleMatch ? decodeXmlEntities(titleMatch[1]) : '';
      const entryUrl = idMatch ? idMatch[1].trim() : '';
      const snippet = summaryMatch ? decodeXmlEntities(summaryMatch[1]).slice(0, 320) : '';

      if (title && snippet && isValidHttpUrl(entryUrl)) {
        results.push({
          title,
          url: entryUrl,
          snippet,
          publishedDate: publishedMatch ? publishedMatch[1].trim() : new Date().toISOString(),
          uncertaintyScore: 0.05,
          source: 'ARXIV',
          sourceName: 'arXiv',
        });
      }
    }

    return results;
  }

  private async queryStackExchange(query: string, timeoutMs: number): Promise<WebSearchResultItem[]> {
    const url = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(query)}&site=stackoverflow&pagesize=3`;
    const res = await this.fetchWithTimeout(
      url,
      { headers: { 'User-Agent': 'DON-AI-Assistant/2.0', Accept: 'application/json' } },
      timeoutMs
    );
    if (!res.ok) return [];

    const data = (await res.json()) as {
      items?: Array<{
        title?: string;
        link?: string;
        score?: number;
        answer_count?: number;
        creation_date?: number;
      }>;
    };

    const results: WebSearchResultItem[] = [];
    for (const item of data.items ?? []) {
      if (item.title && isValidHttpUrl(item.link)) {
        const title = decodeXmlEntities(item.title);
        results.push({
          title,
          url: item.link,
          snippet: `Stack Overflow discussion (score: ${item.score ?? 0}, answers: ${item.answer_count ?? 0}): ${title}`,
          publishedDate: item.creation_date
            ? new Date(item.creation_date * 1000).toISOString()
            : new Date().toISOString(),
          uncertaintyScore: 0.09,
          source: 'STACKEXCHANGE',
          sourceName: 'Stack Overflow',
        });
      }
    }

    return results;
  }

  private async queryGitHub(query: string, timeoutMs: number): Promise<WebSearchResultItem[]> {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=3`;
    const res = await this.fetchWithTimeout(
      url,
      {
        headers: {
          'User-Agent': 'DON-AI-Assistant/2.0',
          Accept: 'application/vnd.github+json',
        },
      },
      timeoutMs
    );
    if (!res.ok) return [];

    const data = (await res.json()) as {
      items?: Array<{
        full_name?: string;
        html_url?: string;
        description?: string | null;
        stargazers_count?: number;
        updated_at?: string;
      }>;
    };

    const results: WebSearchResultItem[] = [];
    for (const repo of data.items ?? []) {
      if (repo.full_name && isValidHttpUrl(repo.html_url)) {
        const desc = repo.description?.trim() || `GitHub repository (${repo.stargazers_count ?? 0} stars)`;
        results.push({
          title: repo.full_name,
          url: repo.html_url,
          snippet: `${desc} (${repo.stargazers_count ?? 0} ★)`,
          publishedDate: repo.updated_at || new Date().toISOString(),
          uncertaintyScore: 0.08,
          source: 'GITHUB',
          sourceName: 'GitHub',
        });
      }
    }

    return results;
  }

  private async queryGoogleLiveRss(query: string, timeoutMs: number): Promise<WebSearchResultItem[]> {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const res = await this.fetchWithTimeout(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
      },
      timeoutMs
    );
    if (!res.ok) return [];

    const xml = await res.text();
    const results: WebSearchResultItem[] = [];
    const itemRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>/g;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null && results.length < 3) {
      const rawTitle = decodeXmlEntities(match[1]);
      const link = match[2].trim();
      const pubDate = match[3].trim();

      if (!rawTitle || !isValidHttpUrl(link)) continue;

      const parts = rawTitle.split(' - ');
      const publisher = parts.length > 1 ? parts.pop()?.trim() : 'Google News';
      const title = parts.join(' - ') || rawTitle;

      let isoDate: string;
      try {
        isoDate = new Date(pubDate).toISOString();
      } catch {
        isoDate = new Date().toISOString();
      }

      results.push({
        title,
        url: link,
        snippet: `Published by ${publisher}: ${title}`,
        publishedDate: isoDate,
        uncertaintyScore: 0.05,
        source: 'GOOGLE_LIVE_RSS',
        sourceName: publisher || 'Google News',
      });
    }

    return results;
  }
}
