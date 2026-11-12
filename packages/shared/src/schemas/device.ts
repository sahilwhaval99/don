import { z } from 'zod';

export const DeviceTypeSchema = z.enum(['DESKTOP_AGENT', 'ANDROID_COMPANION', 'BROWSER_EXTENSION']);
export type DeviceType = z.infer<typeof DeviceTypeSchema>;

export const PairingStatusSchema = z.enum(['PENDING', 'PAIRED', 'REVOKED', 'OFFLINE']);
export type PairingStatus = z.infer<typeof PairingStatusSchema>;

export const DeviceSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1),
  deviceType: DeviceTypeSchema,
  status: PairingStatusSchema.default('PENDING'),
  publicKey: z.string().optional(),
  lastSeenAt: z.string().datetime().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  clientVersion: z.string().default('1.0.0'),
  capabilities: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Device = z.infer<typeof DeviceSchema>;

export const PairingTokenSchema = z.object({
  token: z.string().min(6),
  deviceType: DeviceTypeSchema,
  expiresAt: z.string().datetime(),
  qrPayload: z.string(),
});
export type PairingToken = z.infer<typeof PairingTokenSchema>;

export const AllowlistedAppSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  appName: z.string().min(1),
  executablePath: z.string().min(1),
  icon: z.string().default('app-window'),
  permissionLevel: z.enum(['LAUNCH_ONLY', 'READ_WINDOW_TITLE']).default('LAUNCH_ONLY'),
  isEnabled: z.boolean().default(true),
  trusted: z.boolean().default(false),
  createdAt: z.string().datetime(),
});
export type AllowlistedApp = z.infer<typeof AllowlistedAppSchema>;

export const InstalledAppSourceSchema = z.enum([
  'START_MENU',
  'APPX',
  'SYSTEM_UTILITY',
  'USER_CUSTOM',
]);
export type InstalledAppSource = z.infer<typeof InstalledAppSourceSchema>;

export const InstalledAppEntrySchema = z.object({
  id: z.string().min(1),
  appName: z.string().min(1),
  executablePath: z.string().min(1),
  launchArgs: z.array(z.string()).default([]),
  source: InstalledAppSourceSchema.default('START_MENU'),
  trusted: z.boolean().default(false),
  autoApprove: z.boolean().default(false),
  publisher: z.string().optional(),
  icon: z.string().optional(),
});
export type InstalledAppEntry = z.infer<typeof InstalledAppEntrySchema>;

export const TrustedLaunchModeSchema = z.enum([
  'REQUIRE_APPROVAL',
  'TRUSTED_FAST_LAUNCH',
  'ALLOWLIST_ONLY',
]);
export type TrustedLaunchMode = z.infer<typeof TrustedLaunchModeSchema>;

export const TrustedFastLaunchPolicySchema = z.object({
  enabled: z.boolean().default(true),
  mode: TrustedLaunchModeSchema.default('TRUSTED_FAST_LAUNCH'),
  trustedAppIds: z.array(z.string()).default([]),
  trustedAppNames: z.array(z.string()).default([]),
  enforceRegistryValidation: z.boolean().default(true),
  updatedAt: z.string().datetime().optional(),
});
export type TrustedFastLaunchPolicy = z.infer<typeof TrustedFastLaunchPolicySchema>;
