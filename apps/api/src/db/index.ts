import {
  User,
  Task,
  Project,
  Goal,
  Routine,
  Memory,
  Document,
  Device,
  AllowlistedApp,
  InstalledAppEntry,
  TrustedFastLaunchPolicy,
  AutomationRecipe,
  ToolCallProposal,
  AuditLogEntry,
  KillSwitchStatus,
} from '@don/shared';

// In-Memory High-Fidelity Repository for Disposable Tests & Local Mock Execution
class DatabaseRepository {
  users: Map<string, User & { passwordHash: string }> = new Map();
  refreshTokens: Map<string, { tokenHash: string; userId: string; expiresAt: Date; revoked: boolean }> = new Map();
  tasks: Map<string, Task> = new Map();
  projects: Map<string, Project> = new Map();
  goals: Map<string, Goal> = new Map();
  routines: Map<string, Routine> = new Map();
  memories: Map<string, Memory> = new Map();
  documents: Map<string, Document> = new Map();
  devices: Map<string, Device> = new Map();
  allowlistedApps: Map<string, AllowlistedApp> = new Map();
  installedApps: Map<string, InstalledAppEntry> = new Map();
  trustedPolicy: TrustedFastLaunchPolicy = {
    enabled: false,
    mode: 'REQUIRE_APPROVAL',
    trustedAppIds: [],
    trustedAppNames: [],
    enforceRegistryValidation: true,
  };
  automations: Map<string, AutomationRecipe> = new Map();
  approvals: Map<string, ToolCallProposal & { userId: string }> = new Map();
  auditLogs: AuditLogEntry[] = [];
  killSwitch: KillSwitchStatus = {
    isActivated: false,
    activatedAt: null,
    activatedByUserId: null,
    reason: '',
  };

  constructor() {
    this.seedDefaultData();
  }

  seedDefaultData() {
    // Default Owner User
    const defaultUser: User & { passwordHash: string } = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'owner@don.internal',
      passwordHash: '$2a$10$5Yg7EUDfmlUKGQDrjwFLz.C0UwWKClmn1AATtQWHbI42L094Q/Za2', // 'password123'
      name: 'DON Master Owner',
      role: 'OWNER',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.users.set(defaultUser.id, defaultUser);

    // Default Allowlisted Apps for Desktop Agent
    const calcApp: AllowlistedApp = {
      id: '11111111-1111-1111-1111-111111111111',
      userId: defaultUser.id,
      appName: 'Calculator',
      executablePath: 'C:\\Windows\\System32\\calc.exe',
      icon: 'calculator',
      permissionLevel: 'LAUNCH_ONLY',
      isEnabled: true,
      trusted: false,
      createdAt: new Date().toISOString(),
    };
    const notepadApp: AllowlistedApp = {
      id: '22222222-2222-2222-2222-222222222222',
      userId: defaultUser.id,
      appName: 'Notepad',
      executablePath: 'C:\\Windows\\System32\\notepad.exe',
      icon: 'file-text',
      permissionLevel: 'LAUNCH_ONLY',
      isEnabled: true,
      trusted: false,
      createdAt: new Date().toISOString(),
    };
    this.allowlistedApps.set(calcApp.id, calcApp);
    this.allowlistedApps.set(notepadApp.id, notepadApp);

    const defaultInstalledApps: InstalledAppEntry[] = [
      { id: 'app-calc', appName: 'Calculator', executablePath: 'C:\\Windows\\System32\\calc.exe', launchArgs: [], source: 'SYSTEM_UTILITY', trusted: false, autoApprove: false, icon: 'calculator' },
      { id: 'app-notepad', appName: 'Notepad', executablePath: 'C:\\Windows\\System32\\notepad.exe', launchArgs: [], source: 'SYSTEM_UTILITY', trusted: false, autoApprove: false, icon: 'file-text' },
      { id: 'app-mspaint', appName: 'Paint', executablePath: 'C:\\Windows\\System32\\mspaint.exe', launchArgs: [], source: 'SYSTEM_UTILITY', trusted: false, autoApprove: false, icon: 'palette' },
      { id: 'app-wt', appName: 'Windows Terminal', executablePath: 'C:\\Users\\User\\AppData\\Local\\Microsoft\\WindowsApps\\wt.exe', launchArgs: [], source: 'APPX', trusted: false, autoApprove: false, icon: 'terminal' },
      { id: 'app-explorer', appName: 'File Explorer', executablePath: 'C:\\Windows\\explorer.exe', launchArgs: [], source: 'SYSTEM_UTILITY', trusted: false, autoApprove: false, icon: 'folder' },
      { id: 'app-msedge', appName: 'Microsoft Edge', executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', launchArgs: [], source: 'SYSTEM_UTILITY', trusted: false, autoApprove: false, icon: 'globe' },
      { id: 'app-code', appName: 'Visual Studio Code', executablePath: 'C:\\Users\\User\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe', launchArgs: [], source: 'START_MENU', trusted: false, autoApprove: false, icon: 'code' },
      { id: 'app-spotify', appName: 'Spotify', executablePath: 'C:\\Users\\User\\AppData\\Roaming\\Spotify\\Spotify.exe', launchArgs: [], source: 'START_MENU', trusted: false, autoApprove: false, icon: 'music' },
      { id: 'app-discord', appName: 'Discord', executablePath: 'C:\\Users\\User\\AppData\\Local\\Discord\\Update.exe', launchArgs: [], source: 'START_MENU', trusted: false, autoApprove: false, icon: 'message-circle' },
      { id: 'app-whatsapp', appName: 'WhatsApp', executablePath: 'C:\\Users\\User\\AppData\\Local\\Microsoft\\WindowsApps\\WhatsApp.exe', launchArgs: [], source: 'APPX', trusted: false, autoApprove: false, icon: 'message-square' },
    ];
    for (const entry of defaultInstalledApps) {
      this.installedApps.set(entry.id, entry);
    }

    // Default Routine: Morning Briefing
    const morningRoutine: Routine = {
      id: '33333333-3333-3333-3333-333333333333',
      userId: defaultUser.id,
      name: 'Morning',
      description: 'Review calendar, daily briefing, and activate Focus mode if scheduled.',
      enabled: true,
      scheduleCron: '0 9 * * 1-5',
      steps: [
        {
          id: crypto.randomUUID(),
          title: 'Generate Daily Briefing',
          estimatedMinutes: 2,
          requiresConfirmation: false,
        },
        {
          id: crypto.randomUUID(),
          title: 'Check Urgent Priority Tasks',
          estimatedMinutes: 3,
          requiresConfirmation: false,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.routines.set(morningRoutine.id, morningRoutine);

    // Default Automation: Urgent Task Notification to Paired Phone
    const urgentTaskAutomation: AutomationRecipe = {
      id: '44444444-4444-4444-4444-444444444444',
      userId: defaultUser.id,
      name: 'Urgent Task Notification to Phone',
      description: 'When I add a task marked urgent, send a notification to my paired phone.',
      trigger: {
        type: 'TASK_CREATED_URGENT',
        timezone: 'UTC',
        metadata: {},
      },
      conditions: [],
      actions: [
        {
          id: crypto.randomUUID(),
          toolName: 'propose_phone_dial',
          parameters: { reason: 'Urgent task notification alert' },
          requiresApproval: false,
        },
      ],
      enabled: true,
      rateLimitPerMinute: 5,
      totalExecutions: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.automations.set(urgentTaskAutomation.id, urgentTaskAutomation);
  }

  reset() {
    this.users.clear();
    this.refreshTokens.clear();
    this.tasks.clear();
    this.projects.clear();
    this.goals.clear();
    this.routines.clear();
    this.memories.clear();
    this.documents.clear();
    this.devices.clear();
    this.allowlistedApps.clear();
    this.installedApps.clear();
    this.trustedPolicy = {
      enabled: false,
      mode: 'REQUIRE_APPROVAL',
      trustedAppIds: [],
      trustedAppNames: [],
      enforceRegistryValidation: true,
    };
    this.automations.clear();
    this.approvals.clear();
    this.auditLogs = [];
    this.killSwitch = {
      isActivated: false,
      activatedAt: null,
      activatedByUserId: null,
      reason: '',
    };
    this.seedDefaultData();
  }
}

export const db = new DatabaseRepository();
