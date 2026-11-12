import { z } from 'zod';

export const AuditStatusSchema = z.enum([
  'PROPOSED',
  'AWAITING_APPROVAL',
  'APPROVED',
  'AUTO_APPROVED_TRUSTED',
  'DENIED',
  'EXECUTED',
  'BLOCKED_BY_KILL_SWITCH',
  'FAILED',
]);
export type AuditStatus = z.infer<typeof AuditStatusSchema>;

export const AuditLogEntrySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  deviceId: z.string().nullable().optional(),
  deviceType: z.string().default('WEB'),
  toolName: z.string(),
  parameters: z.record(z.unknown()),
  targetResource: z.string().default('SYSTEM'),
  consequenceSummary: z.string(),
  status: AuditStatusSchema,
  decisionMadeBy: z.string().default('USER'),
  errorDetails: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

export const KillSwitchStatusSchema = z.object({
  isActivated: z.boolean(),
  activatedAt: z.string().datetime().nullable(),
  activatedByUserId: z.string().uuid().nullable(),
  reason: z.string().default(''),
});
export type KillSwitchStatus = z.infer<typeof KillSwitchStatusSchema>;
