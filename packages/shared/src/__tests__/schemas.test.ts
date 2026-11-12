import { describe, it, expect } from 'vitest';
import {
  CreateTaskRequestSchema,
  TaskSchema,
  DeviceTypeSchema,
  DeviceSchema,
  KillSwitchStatusSchema,
  AuditLogEntrySchema,
  AuditStatusSchema,
  ToolCallProposalSchema,
  ALLOWED_TOOLS,
  EdgeOpenNewTabParamSchema,
  EdgeSwitchTabParamSchema,
  EdgeMediaControlParamSchema,
  EdgeBrowserTabSchema,
  InstalledAppEntrySchema,
  TrustedFastLaunchPolicySchema,
  WhatsAppSearchDownloadOpenParamSchema,
  WhatsAppCallParamSchema,
  MultiSourceCitationSchema,
  WebSearchResultItemSchema,
} from '../index.js';

describe('@don/shared Schemas', () => {
  describe('TaskSchema & CreateTaskRequestSchema', () => {
    it('validates a valid task creation request', () => {
      const valid = {
        title: 'Complete security architecture review',
        description: 'Verify mutual TLS and allowlist constraints',
        priority: 'HIGH' as const,
        dueDate: new Date().toISOString(),
        labels: ['security', 'core'],
      };

      const result = CreateTaskRequestSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe(valid.title);
        expect(result.data.priority).toBe('HIGH');
      }
    });

    it('rejects empty task title', () => {
      const invalid = {
        title: '',
        priority: 'MEDIUM',
      };
      const result = CreateTaskRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects invalid task priority', () => {
      const invalid = {
        title: 'Valid title',
        priority: 'SUPER_URGENT_INVALID',
      };
      const result = CreateTaskRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Device Schema', () => {
    it('validates device model with Android companion type', () => {
      const validDevice = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Pixel 8 Pro Companion',
        deviceType: 'ANDROID_COMPANION' as const,
        status: 'PAIRED' as const,
        clientVersion: '1.0.0',
        capabilities: ['DIALER', 'NOTIFICATIONS', 'APPROVALS'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = DeviceSchema.safeParse(validDevice);
      expect(result.success).toBe(true);
    });

    it('rejects unsupported device type', () => {
      const invalid = 'MICROWAVE_INVALID';
      const result = DeviceTypeSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Kill Switch Schema', () => {
    it('validates active kill switch payload', () => {
      const killSwitch = {
        isActivated: true,
        activatedAt: new Date().toISOString(),
        activatedByUserId: '00000000-0000-0000-0000-000000000001',
        reason: 'Emergency operator intervention',
      };
      const result = KillSwitchStatusSchema.safeParse(killSwitch);
      expect(result.success).toBe(true);
    });
  });

  describe('ToolCallProposalSchema', () => {
    it('validates consequential tool call proposal', () => {
      const proposal = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        toolName: 'propose_open_desktop_app',
        parameters: { appName: 'Calculator' },
        consequence: {
          target: 'Desktop App: Calculator',
          description: 'Launch allowlisted application Calculator on Windows',
          isReversible: false,
          riskLevel: 'MEDIUM' as const,
          requiresLocalAgent: true,
          requiresAndroidCompanion: false,
        },
        requiresApproval: true,
        status: 'PENDING' as const,
        createdAt: new Date().toISOString(),
      };
      const result = ToolCallProposalSchema.safeParse(proposal);
      expect(result.success).toBe(true);
    });
  });

  describe('Phase 2 Schemas (Edge, Trusted Fast-Launch, WhatsApp, Multi-Source)', () => {
    it('includes Edge browser and WhatsApp tools in ALLOWED_TOOLS', () => {
      expect(ALLOWED_TOOLS).toContain('open_new_tab');
      expect(ALLOWED_TOOLS).toContain('switch_tab');
      expect(ALLOWED_TOOLS).toContain('list_open_tabs');
      expect(ALLOWED_TOOLS).toContain('read_active_page_summary');
      expect(ALLOWED_TOOLS).toContain('media_control');
      expect(ALLOWED_TOOLS).toContain('whatsapp_search_download_open');
      expect(ALLOWED_TOOLS).toContain('whatsapp_call');
    });

    it('validates Edge browser action parameter schemas', () => {
      expect(EdgeOpenNewTabParamSchema.safeParse({ url: 'https://youtube.com' }).success).toBe(true);
      expect(EdgeSwitchTabParamSchema.safeParse({ titleOrUrlMatch: 'github' }).success).toBe(true);
      expect(EdgeMediaControlParamSchema.safeParse({ command: 'PAUSE' }).success).toBe(true);
      expect(
        EdgeBrowserTabSchema.safeParse({
          id: 42,
          title: 'GitHub',
          url: 'https://github.com',
          active: true,
        }).success
      ).toBe(true);
    });

    it('validates Trusted Fast-Launch policy, InstalledAppEntry, and AUTO_APPROVED_TRUSTED audit status', () => {
      expect(AuditStatusSchema.safeParse('AUTO_APPROVED_TRUSTED').success).toBe(true);
      const appEntry = InstalledAppEntrySchema.safeParse({
        id: 'win-calc',
        appName: 'Calculator',
        executablePath: 'C:\\Windows\\System32\\calc.exe',
        source: 'SYSTEM_UTILITY',
        trusted: true,
        autoApprove: true,
      });
      expect(appEntry.success).toBe(true);

      const policy = TrustedFastLaunchPolicySchema.safeParse({
        enabled: true,
        mode: 'TRUSTED_FAST_LAUNCH',
        trustedAppIds: ['win-calc'],
        trustedAppNames: ['Calculator'],
      });
      expect(policy.success).toBe(true);
    });

    it('validates WhatsApp integration parameter schemas', () => {
      const searchDoc = WhatsAppSearchDownloadOpenParamSchema.safeParse({
        query: 'syllabus',
        openAfterDownload: true,
        openInEdge: true,
      });
      expect(searchDoc.success).toBe(true);

      const call = WhatsAppCallParamSchema.safeParse({
        contactName: 'Mom',
        callType: 'VOICE',
      });
      expect(call.success).toBe(true);
    });

    it('validates multi-source knowledge citations', () => {
      const cite = MultiSourceCitationSchema.safeParse({
        title: 'Quantum computing',
        url: 'https://en.wikipedia.org/wiki/Quantum_computing',
        snippet: 'Quantum computing is a type of computation...',
        source: 'WIKIPEDIA',
        sourceName: 'Wikipedia',
        uncertaintyScore: 0.05,
      });
      expect(cite.success).toBe(true);
      expect(
        WebSearchResultItemSchema.safeParse({
          title: 'arXiv paper',
          url: 'https://arxiv.org/abs/2401.00001',
          snippet: 'Abstract text',
          source: 'ARXIV',
        }).success
      ).toBe(true);
    });
  });
});
