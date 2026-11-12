import fs from 'fs';
import path from 'path';
import os from 'os';
import child_process from 'child_process';

export interface LocalDocumentMatch {
  name: string;
  path: string;
  sizeBytes: number;
  modifiedAt: string;
  extension: string;
  folder: string;
}

const SAFE_DOC_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.doc',
  '.xlsx',
  '.xls',
  '.pptx',
  '.ppt',
  '.txt',
  '.md',
  '.csv',
  '.rtf',
]);

export function getAuthorizedDocumentDirs(extraDirs: string[] = []): string[] {
  const home = os.homedir();
  const defaults = [
    path.join(home, 'Downloads'),
    path.join(home, 'Documents', 'WhatsApp'),
    path.join(home, 'Downloads', 'WhatsApp'),
  ];
  const all = [...defaults, ...extraDirs].filter(Boolean).map((d) => path.resolve(d));
  return Array.from(new Set(all));
}

export function isPathInAuthorizedDirs(targetPath: string, authorizedDirs: string[]): boolean {
  const resolvedTarget = path.resolve(targetPath);
  return authorizedDirs.some((dir) => {
    const resolvedDir = path.resolve(dir);
    const rel = path.relative(resolvedDir, resolvedTarget);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  });
}

export function searchLocalDocuments(
  query: string,
  extraAuthorizedDirs: string[] = [],
  maxResults = 20
): LocalDocumentMatch[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const dirs = getAuthorizedDocumentDirs(extraAuthorizedDirs);
  const matches: LocalDocumentMatch[] = [];
  const seen = new Set<string>();

  const scanDir = (dir: string, depth: number) => {
    if (depth > 3 || matches.length >= maxResults) return;
    try {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (matches.length >= maxResults) break;
        const fullPath = path.resolve(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath, depth + 1);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (!SAFE_DOC_EXTENSIONS.has(ext)) continue;
          if (!entry.name.toLowerCase().includes(normalizedQuery)) continue;
          if (seen.has(fullPath.toLowerCase())) continue;
          seen.add(fullPath.toLowerCase());

          const stat = fs.statSync(fullPath);
          matches.push({
            name: entry.name,
            path: fullPath,
            sizeBytes: stat.size,
            modifiedAt: stat.mtime.toISOString(),
            extension: ext,
            folder: dir,
          });
        }
      }
    } catch {
      // Ignore unreadable folders
    }
  };

  for (const dir of dirs) {
    scanDir(dir, 0);
  }

  // Sort most recently modified first
  matches.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  return matches.slice(0, maxResults);
}

export function buildWhatsAppProtocolUri(params: {
  action: 'call' | 'chat';
  phoneNumber?: string;
  contactName?: string;
  message?: string;
}): string {
  const cleanPhone = (params.phoneNumber || '').replace(/[^\d+]/g, '');
  if (params.action === 'call') {
    if (cleanPhone) {
      return `whatsapp://call?phone=${encodeURIComponent(cleanPhone)}`;
    }
    return 'whatsapp://';
  }

  const queryParts: string[] = [];
  if (cleanPhone) {
    queryParts.push(`phone=${encodeURIComponent(cleanPhone)}`);
  }
  if (params.message) {
    queryParts.push(`text=${encodeURIComponent(params.message)}`);
  }
  return queryParts.length > 0 ? `whatsapp://send?${queryParts.join('&')}` : 'whatsapp://';
}

export function launchWhatsAppProtocolUri(uri: string): {
  success: boolean;
  uri: string;
  simulated: boolean;
} {
  if (!uri.startsWith('whatsapp://')) {
    throw new Error('Security violation: Only whatsapp:// protocol URIs are permitted.');
  }
  if (/[;&|`$><\r\n]/.test(uri)) {
    throw new Error('Security violation: Unsafe characters in whatsapp:// URI.');
  }

  if (process.platform === 'win32') {
    try {
      const child = child_process.spawn('explorer.exe', [uri], {
        detached: true,
        stdio: 'ignore',
      });
      if (child && typeof child.on === 'function') {
        child.on('error', () => { /* ignore */ });
      }
      child.unref();
    } catch {
      // ignore spawn error
    }
    return { success: true, uri, simulated: false };
  }

  return { success: true, uri, simulated: true };
}
