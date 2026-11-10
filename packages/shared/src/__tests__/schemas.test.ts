import { describe, it, expect } from 'vitest';
import {
  CreateTaskRequestSchema,
  TaskSchema,
  DeviceTypeSchema,
  DeviceSchema,
  KillSwitchStatusSchema,
  AuditLogEntrySchema,
  ToolCallProposalSchema,
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
});
