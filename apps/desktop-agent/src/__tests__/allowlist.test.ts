import { describe, it, expect, beforeEach } from 'vitest';
import { AppAllowlistManager } from '../allowlist.js';

describe('AppAllowlistManager', () => {
  let manager: AppAllowlistManager;

  beforeEach(() => {
    manager = new AppAllowlistManager();
  });

  it('allows default registered apps (Calculator, Notepad, Paint)', () => {
    const calc = manager.isAllowed('Calculator');
    expect(calc.allowed).toBe(true);
    expect(calc.fixedExecutablePath).toContain('calc.exe');

    const notepad = manager.isAllowed('notepad');
    expect(notepad.allowed).toBe(true);
    expect(notepad.fixedExecutablePath).toContain('notepad.exe');
  });

  it('rejects unregistered arbitrary applications', () => {
    const bash = manager.isAllowed('bash');
    expect(bash.allowed).toBe(false);
    expect(bash.reason).toContain('not on the user allowlist');

    const powershell = manager.isAllowed('powershell.exe');
    expect(powershell.allowed).toBe(false);
  });

  it('rejects path mismatch / attempted binary path tampering', () => {
    const tampered = manager.isAllowed('Calculator', 'C:\\malicious\\fake_calc.exe');
    expect(tampered.allowed).toBe(false);
    expect(tampered.reason).toContain('Path mismatch');
  });
});
