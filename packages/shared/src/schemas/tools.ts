import { z } from 'zod';
import { ALLOWED_TOOLS, AllowedToolName } from '../constants.js';

export const RiskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const ApprovalConsequenceSchema = z.object({
  target: z.string(),
  description: z.string(),
  isReversible: z.boolean(),
  riskLevel: RiskLevelSchema,
  requiresLocalAgent: z.boolean().default(false),
  requiresAndroidCompanion: z.boolean().default(false),
});
export type ApprovalConsequence = z.infer<typeof ApprovalConsequenceSchema>;

export const ToolCallProposalSchema = z.object({
  id: z.string().uuid(),
  toolName: z.enum(ALLOWED_TOOLS),
  parameters: z.record(z.unknown()),
  consequence: ApprovalConsequenceSchema,
  requiresApproval: z.boolean(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED']).default('PENDING'),
  createdAt: z.string().datetime(),
});
export type ToolCallProposal = z.infer<typeof ToolCallProposalSchema>;

// Tool Parameter Schemas
export const WebSearchParamSchema = z.object({
  query: z.string().min(1),
  maxResults: z.number().int().min(1).max(10).default(5),
  safeSearch: z.boolean().default(true),
  domainAllowlist: z.array(z.string()).optional(),
  domainBlocklist: z.array(z.string()).optional(),
});
export type WebSearchParam = z.infer<typeof WebSearchParamSchema>;

export const WebSearchResultItemSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  snippet: z.string(),
  publishedDate: z.string().nullable().optional(),
  uncertaintyScore: z.number().min(0).max(1).default(0.1),
});
export type WebSearchResultItem = z.infer<typeof WebSearchResultItemSchema>;

export const ConnectedDocParamSchema = z.object({
  question: z.string().min(1),
  documentIds: z.array(z.string().uuid()).optional(),
});
export type ConnectedDocParam = z.infer<typeof ConnectedDocParamSchema>;

export const CalendarDraftParamSchema = z.object({
  title: z.string().min(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  attendees: z.array(z.string().email()).default([]),
  description: z.string().default(''),
  location: z.string().optional(),
});
export type CalendarDraftParam = z.infer<typeof CalendarDraftParamSchema>;

export const EmailDraftParamSchema = z.object({
  to: z.array(z.string().email()).min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  isReplyToId: z.string().optional(),
});
export type EmailDraftParam = z.infer<typeof EmailDraftParamSchema>;

export const MessageDraftParamSchema = z.object({
  recipient: z.string().min(1),
  platform: z.enum(['SMS', 'SLACK', 'TEAMS', 'DISCORD']).default('SMS'),
  content: z.string().min(1),
});
export type MessageDraftParam = z.infer<typeof MessageDraftParamSchema>;

export const ScreenCaptureRequestParamSchema = z.object({
  windowTitleOrTarget: z.string().default('active_window'),
  purpose: z.string().min(1),
});
export type ScreenCaptureRequestParam = z.infer<typeof ScreenCaptureRequestParamSchema>;

export const AnalyzeSharedContentParamSchema = z.object({
  contentType: z.enum(['IMAGE', 'DOCUMENT', 'SCREEN_SNIPPET', 'BROWSER_DOM']),
  dataPayload: z.string(), // base64 or text
  prompt: z.string().min(1),
});
export type AnalyzeSharedContentParam = z.infer<typeof AnalyzeSharedContentParamSchema>;

export const ProposeOpenDesktopAppParamSchema = z.object({
  appId: z.string().uuid().optional(),
  appName: z.string().min(1),
  reason: z.string().min(1),
});
export type ProposeOpenDesktopAppParam = z.infer<typeof ProposeOpenDesktopAppParamSchema>;

export const ProposeOpenWebsiteParamSchema = z.object({
  url: z.string().url(),
  reason: z.string().min(1),
});
export type ProposeOpenWebsiteParam = z.infer<typeof ProposeOpenWebsiteParamSchema>;

export const ProposeBrowserActionParamSchema = z.object({
  actionType: z.enum(['NAVIGATE', 'NEW_TAB', 'YOUTUBE_SEARCH', 'YOUTUBE_PLAY_PAUSE', 'INSPECT_PAGE']),
  targetUrl: z.string().url().optional(),
  actionDetails: z.record(z.unknown()).default({}),
});
export type ProposeBrowserActionParam = z.infer<typeof ProposeBrowserActionParamSchema>;

export const ProposePhoneDialParamSchema = z.object({
  phoneNumber: z.string().min(3),
  contactName: z.string().optional(),
  reason: z.string().min(1),
});
export type ProposePhoneDialParam = z.infer<typeof ProposePhoneDialParamSchema>;

export const ProposePhoneCallParamSchema = z.object({
  phoneNumber: z.string().min(3),
  contactName: z.string().optional(),
  reason: z.string().min(1),
  explicitDirectCallConsentRequired: z.literal(true),
});
export type ProposePhoneCallParam = z.infer<typeof ProposePhoneCallParamSchema>;
