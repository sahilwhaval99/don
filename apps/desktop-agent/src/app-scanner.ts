import fs from 'fs';
import path from 'path';
import os from 'os';
import child_process from 'child_process';

export type AppSource = 'start_menu' | 'appx' | 'utility' | 'mock';

export interface DiscoveredApp {
  appName: string;
  executablePath: string;
  source: AppSource;
  icon?: string;
}

export interface ScanOptions {
  /** Override Start Menu directories (useful for testing) */
  startMenuDirs?: string[];
  /** Force deterministic mock fallback (useful in Linux CI or unit tests) */
  forceMock?: boolean;
  /** Skip PowerShell Get-StartApps query on Windows (useful for fast unit tests) */
  skipAppxQuery?: boolean;
}

const COMMON_UTILITY_DEFINITIONS: Array<{
  appName: string;
  aliases: string[];
  icon: string;
  candidatePaths: () => string[];
  mockPath: string;
}> = [
  {
    appName: 'Calculator',
    aliases: ['calc', 'calc.exe'],
    icon: 'calculator',
    candidatePaths: () => ['C:\\Windows\\System32\\calc.exe'],
    mockPath: 'C:\\Windows\\System32\\calc.exe',
  },
  {
    appName: 'Notepad',
    aliases: ['notepad', 'notepad.exe'],
    icon: 'file-text',
    candidatePaths: () => ['C:\\Windows\\System32\\notepad.exe'],
    mockPath: 'C:\\Windows\\System32\\notepad.exe',
  },
  {
    appName: 'Paint',
    aliases: ['mspaint', 'mspaint.exe'],
    icon: 'palette',
    candidatePaths: () => ['C:\\Windows\\System32\\mspaint.exe'],
    mockPath: 'C:\\Windows\\System32\\mspaint.exe',
  },
  {
    appName: 'Windows Terminal',
    aliases: ['wt', 'wt.exe', 'terminal'],
    icon: 'terminal',
    candidatePaths: () => [
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps', 'wt.exe'),
    ],
    mockPath: 'C:\\Users\\User\\AppData\\Local\\Microsoft\\WindowsApps\\wt.exe',
  },
  {
    appName: 'File Explorer',
    aliases: ['explorer', 'explorer.exe'],
    icon: 'folder',
    candidatePaths: () => ['C:\\Windows\\explorer.exe'],
    mockPath: 'C:\\Windows\\explorer.exe',
  },
  {
    appName: 'Microsoft Edge',
    aliases: ['msedge', 'msedge.exe', 'edge'],
    icon: 'globe',
    candidatePaths: () => [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ],
    mockPath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  },
  {
    appName: 'Visual Studio Code',
    aliases: ['code', 'code.exe', 'vscode'],
    icon: 'code',
    candidatePaths: () => [
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'Code.exe'),
      'C:\\Program Files\\Microsoft VS Code\\Code.exe',
    ],
    mockPath: 'C:\\Users\\User\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe',
  },
  {
    appName: 'Spotify',
    aliases: ['spotify', 'spotify.exe'],
    icon: 'music',
    candidatePaths: () => [
      path.join(process.env.APPDATA || '', 'Spotify', 'Spotify.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps', 'Spotify.exe'),
    ],
    mockPath: 'C:\\Users\\User\\AppData\\Roaming\\Spotify\\Spotify.exe',
  },
  {
    appName: 'Discord',
    aliases: ['discord', 'discord.exe'],
    icon: 'message-circle',
    candidatePaths: () => [
      path.join(process.env.LOCALAPPDATA || '', 'Discord', 'Update.exe'),
    ],
    mockPath: 'C:\\Users\\User\\AppData\\Local\\Discord\\Update.exe',
  },
  {
    appName: 'WhatsApp',
    aliases: ['whatsapp', 'whatsapp.exe'],
    icon: 'message-square',
    candidatePaths: () => [
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps', 'WhatsApp.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'WhatsApp', 'WhatsApp.exe'),
    ],
    mockPath: 'C:\\Users\\User\\AppData\\Local\\Microsoft\\WindowsApps\\WhatsApp.exe',
  },
];

function walkLnkFiles(dir: string, results: DiscoveredApp[] = []): DiscoveredApp[] {
  if (!dir) return results;
  try {
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkLnkFiles(fullPath, results);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.lnk')) {
        const appName = entry.name.slice(0, -4).trim();
        if (appName && !appName.toLowerCase().includes('uninstall')) {
          results.push({
            appName,
            executablePath: path.normalize(fullPath),
            source: 'start_menu',
            icon: 'app-window',
          });
        }
      }
    }
  } catch {
    // Ignore permission or IO errors on individual Start Menu folders
  }
  return results;
}

export function getDefaultStartMenuDirs(): string[] {
  const programData = process.env.ProgramData || 'C:\\ProgramData';
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return [
    path.join(programData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
  ];
}

export function getMockDiscoveredApps(): DiscoveredApp[] {
  return COMMON_UTILITY_DEFINITIONS.map((def) => ({
    appName: def.appName,
    executablePath: def.mockPath,
    source: 'mock',
    icon: def.icon,
  }));
}

export function scanStartMenuShortcuts(dirs?: string[]): DiscoveredApp[] {
  const targetDirs = dirs && dirs.length > 0 ? dirs : getDefaultStartMenuDirs();
  const discovered: DiscoveredApp[] = [];
  for (const dir of targetDirs) {
    walkLnkFiles(dir, discovered);
  }
  return discovered;
}

export function scanCommonUtilities(): DiscoveredApp[] {
  const found: DiscoveredApp[] = [];
  for (const def of COMMON_UTILITY_DEFINITIONS) {
    for (const candidate of def.candidatePaths()) {
      if (!candidate) continue;
      try {
        if (fs.existsSync(candidate)) {
          found.push({
            appName: def.appName,
            executablePath: path.normalize(candidate),
            source: 'utility',
            icon: def.icon,
          });
          break;
        }
      } catch {
        // Ignore inaccessible paths
      }
    }
  }
  return found;
}

export function scanAppxStartApps(): DiscoveredApp[] {
  if (process.platform !== 'win32') return [];
  try {
    const raw = child_process.execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', 'Get-StartApps | Select-Object Name, AppID | ConvertTo-Json -Compress'],
      { timeout: 2500, windowsHide: true, encoding: 'utf8' }
    );
    if (!raw || !raw.trim()) return [];
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    const apps: DiscoveredApp[] = [];
    for (const item of items) {
      if (item && typeof item.Name === 'string' && typeof item.AppID === 'string' && item.Name.trim()) {
        apps.push({
          appName: item.Name.trim(),
          executablePath: `shell:AppsFolder\\${item.AppID.trim()}`,
          source: 'appx',
          icon: 'app-window',
        });
      }
    }
    return apps;
  } catch {
    return [];
  }
}

export function scanInstalledApps(options: ScanOptions = {}): DiscoveredApp[] {
  if (options.forceMock || (process.platform !== 'win32' && !options.startMenuDirs)) {
    return getMockDiscoveredApps();
  }

  const byName = new Map<string, DiscoveredApp>();
  const addAll = (apps: DiscoveredApp[]) => {
    for (const app of apps) {
      const key = app.appName.toLowerCase();
      if (!byName.has(key)) {
        byName.set(key, app);
      }
    }
  };

  addAll(scanCommonUtilities());
  addAll(scanStartMenuShortcuts(options.startMenuDirs));
  if (!options.skipAppxQuery && process.platform === 'win32') {
    addAll(scanAppxStartApps());
  }

  // Ensure common utilities are always represented if nothing was found
  if (byName.size === 0) {
    return getMockDiscoveredApps();
  }

  return Array.from(byName.values());
}
