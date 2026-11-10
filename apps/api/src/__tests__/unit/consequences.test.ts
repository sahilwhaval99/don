import { describe, it, expect } from 'vitest';
import { evaluateConsequence } from '@don/ai';

describe('Consequence and Approval Rules', () => {
  it('marks safe queries (web_search, create_task) as NOT requiring approval', () => {
    const searchCheck = evaluateConsequence('web_search', { query: 'TypeScript documentation' });
    expect(searchCheck.requiresApproval).toBe(false);
    expect(searchCheck.consequence.riskLevel).toBe('LOW');

    const taskCheck = evaluateConsequence('create_task', { title: 'Review PR' });
    expect(taskCheck.requiresApproval).toBe(false);
  });

  it('marks desktop app launch as requiring approval', () => {
    const appCheck = evaluateConsequence('propose_open_desktop_app', { appName: 'Calculator' });
    expect(appCheck.requiresApproval).toBe(true);
    expect(appCheck.consequence.requiresLocalAgent).toBe(true);
  });

  it('marks screen capture as requiring approval with HIGH risk', () => {
    const screenCheck = evaluateConsequence('request_screen_capture', { windowTitleOrTarget: 'Screen' });
    expect(screenCheck.requiresApproval).toBe(true);
    expect(screenCheck.consequence.riskLevel).toBe('HIGH');
    expect(screenCheck.consequence.requiresLocalAgent).toBe(true);
  });

  it('marks direct phone call as requiring CRITICAL approval on Android companion', () => {
    const callCheck = evaluateConsequence('propose_phone_call', { phoneNumber: '+15550199' });
    expect(callCheck.requiresApproval).toBe(true);
    expect(callCheck.consequence.riskLevel).toBe('CRITICAL');
    expect(callCheck.consequence.requiresAndroidCompanion).toBe(true);
  });
});
