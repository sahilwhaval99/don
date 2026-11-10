import path from 'path';

export interface AllowlistEntry {
  appName: string;
  executablePath: string;
  isEnabled: boolean;
}

export class AppAllowlistManager {
  private allowedApps: Map<string, AllowlistEntry> = new Map();

  constructor() {
    // Default safe system binaries with fixed paths
    this.registerApp('Calculator', 'C:\\Windows\\System32\\calc.exe');
    this.registerApp('Notepad', 'C:\\Windows\\System32\\notepad.exe');
    this.registerApp('Paint', 'C:\\Windows\\System32\\mspaint.exe');
  }

  registerApp(appName: string, fixedPath: string): void {
    // Normalize path to prevent directory traversal or relative path injection
    const normalized = path.normalize(fixedPath);
    this.allowedApps.set(appName.toLowerCase(), {
      appName,
      executablePath: normalized,
      isEnabled: true,
    });
  }

  isAllowed(appName: string, requestedPath?: string): { allowed: boolean; fixedExecutablePath?: string; reason?: string } {
    const entry = this.allowedApps.get(appName.toLowerCase());
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
      const normalizedReq = path.normalize(requestedPath);
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
    };
  }

  getAll(): AllowlistEntry[] {
    return Array.from(this.allowedApps.values());
  }
}
