import path from 'path';
import type { DiscoveredApp, AppSource } from './app-scanner.js';

export interface AllowlistEntry {
  appName: string;
  executablePath: string;
  isEnabled: boolean;
  trusted: boolean;
  autoAllow: boolean;
  source: AppSource | 'builtin' | 'manual';
  icon?: string;
}

const APP_ALIASES: Record<string, string> = {
  calc: 'calculator',
  'calc.exe': 'calculator',
  'notepad.exe': 'notepad',
  mspaint: 'paint',
  'mspaint.exe': 'paint',
  wt: 'windows terminal',
  'wt.exe': 'windows terminal',
  terminal: 'windows terminal',
  explorer: 'file explorer',
  'explorer.exe': 'file explorer',
  msedge: 'microsoft edge',
  'msedge.exe': 'microsoft edge',
  edge: 'microsoft edge',
  code: 'visual studio code',
  'code.exe': 'visual studio code',
  vscode: 'visual studio code',
  'spotify.exe': 'spotify',
  'discord.exe': 'discord',
  'whatsapp.exe': 'whatsapp',
};

const SHELL_METACHARS = /[;&|`$><\r\n]/;

export function isSafeRegistryPath(rawPath: string): boolean {
  if (!rawPath || SHELL_METACHARS.test(rawPath)) return false;
  if (rawPath.includes('..')) return false;
  if (rawPath.startsWith('shell:AppsFolder\\')) {
    return /^shell:AppsFolder\\[A-Za-z0-9._!\\-]+$/.test(rawPath);
  }
  return path.isAbsolute(rawPath) || /^[A-Za-z]:\\/.test(rawPath);
}

export class AppAllowlistManager {
  private allowedApps: Map<string, AllowlistEntry> = new Map();
  private globalTrustedFastLaunch = false;

  constructor() {
    // Default safe system binaries with fixed paths
    this.registerApp('Calculator', 'C:\\Windows\\System32\\calc.exe', { source: 'builtin', icon: 'calculator' });
    this.registerApp('Notepad', 'C:\\Windows\\System32\\notepad.exe', { source: 'builtin', icon: 'file-text' });
    this.registerApp('Paint', 'C:\\Windows\\System32\\mspaint.exe', { source: 'builtin', icon: 'palette' });
  }

  private resolveKey(appName: string): string {
    const lower = appName.trim().toLowerCase();
    return APP_ALIASES[lower] || lower;
  }

  registerApp(
    appName: string,
    fixedPath: string,
    options: { trusted?: boolean; autoAllow?: boolean; source?: AllowlistEntry['source']; icon?: string } = {}
  ): void {
    if (!isSafeRegistryPath(fixedPath)) {
      throw new Error(`Security violation: Unsafe executable path "${fixedPath}" rejected.`);
    }
    const normalized = fixedPath.startsWith('shell:AppsFolder\\') ? fixedPath : path.normalize(fixedPath);
    const key = appName.trim().toLowerCase();
    this.allowedApps.set(key, {
      appName: appName.trim(),
      executablePath: normalized,
      isEnabled: true,
      trusted: Boolean(options.trusted),
      autoAllow: Boolean(options.autoAllow ?? options.trusted),
      source: options.source || 'manual',
      icon: options.icon || 'app-window',
    });
  }

  registerScannedApps(apps: DiscoveredApp[], defaultTrusted = false): void {
    for (const app of apps) {
      if (!isSafeRegistryPath(app.executablePath)) continue;
      const key = app.appName.trim().toLowerCase();
      const existing = this.allowedApps.get(key);
      if (existing) {
        // Preserve existing trusted/enabled flags while updating path if discovered
        existing.executablePath = app.executablePath.startsWith('shell:AppsFolder\\')
          ? app.executablePath
          : path.normalize(app.executablePath);
        existing.source = app.source;
        if (app.icon) existing.icon = app.icon;
      } else {
        this.registerApp(app.appName, app.executablePath, {
          trusted: defaultTrusted,
          autoAllow: defaultTrusted,
          source: app.source,
          icon: app.icon,
        });
      }
    }
  }

  setGlobalTrustedFastLaunch(enabled: boolean): void {
    this.globalTrustedFastLaunch = enabled;
  }

  isGlobalTrustedFastLaunchEnabled(): boolean {
    return this.globalTrustedFastLaunch;
  }

  setTrusted(appName: string, trusted: boolean): AllowlistEntry {
    const key = this.resolveKey(appName);
    const entry = this.allowedApps.get(key) || this.allowedApps.get(appName.trim().toLowerCase());
    if (!entry) {
      throw new Error(`Application "${appName}" is not in the Trusted Registry.`);
    }
    entry.trusted = trusted;
    entry.autoAllow = trusted;
    return entry;
  }

  isAllowed(
    appName: string,
    requestedPath?: string
  ): { allowed: boolean; fixedExecutablePath?: string; trusted?: boolean; reason?: string } {
    const directKey = appName.trim().toLowerCase();
    const aliasKey = this.resolveKey(appName);
    const entry = this.allowedApps.get(directKey) || this.allowedApps.get(aliasKey);

    if (!entry) {
      return {
        allowed: false,
        reason: `Application "${appName}" is not on the user allowlist.`,
      };
    }

    if (!entry.isEnabled) {
      return {
        allowed: false,
        reason: `Application "${appName}" is disabled in user allowlist.`,
      };
    }

    if (requestedPath) {
      if (!isSafeRegistryPath(requestedPath)) {
        return {
          allowed: false,
          reason: `Security violation: Unsafe requested path "${requestedPath}".`,
        };
      }
      const normalizedReq = requestedPath.startsWith('shell:AppsFolder\\')
        ? requestedPath
        : path.normalize(requestedPath);
      if (normalizedReq.toLowerCase() !== entry.executablePath.toLowerCase()) {
        return {
          allowed: false,
          reason: `Security violation: Path mismatch for ${appName}. Expected: ${entry.executablePath}, received: ${normalizedReq}`,
        };
      }
    }

    return {
      allowed: true,
      fixedExecutablePath: entry.executablePath,
      trusted: entry.trusted && entry.autoAllow,
    };
  }

  isTrustedFastLaunchAllowed(
    appName: string,
    requestedPath?: string
  ): { allowed: boolean; fixedExecutablePath?: string; reason?: string } {
    if (!this.globalTrustedFastLaunch) {
      return { allowed: false, reason: 'Trusted Fast-Launch is disabled.' };
    }
    const check = this.isAllowed(appName, requestedPath);
    if (!check.allowed) {
      return check;
    }
    if (!check.trusted) {
      return {
        allowed: false,
        reason: `Application "${appName}" is not marked trusted for Fast-Launch.`,
      };
    }
    return {
      allowed: true,
      fixedExecutablePath: check.fixedExecutablePath,
    };
  }

  getAll(): AllowlistEntry[] {
    return Array.from(this.allowedApps.values());
  }
}
