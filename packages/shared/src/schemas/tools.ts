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

export const KnowledgeSourceTypeSchema = z.enum([
  'WIKIPEDIA',
  'DUCKDUCKGO',
  'ARXIV',
  'STACKEXCHANGE',
  'GITHUB',
  'GOOGLE_LIVE_RSS',
  'GOOGLE_CSE',
  'BRAVE',
  'TAVILY',
  'WEB',
]);
export type KnowledgeSourceType = z.infer<typeof KnowledgeSourceTypeSchema>;

export const WebSearchResultItemSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  snippet: z.string(),
  publishedDate: z.string().nullable().optional(),
  uncertaintyScore: z.number().min(0).max(1).default(0.1),
  source: KnowledgeSourceTypeSchema.optional(),
  sourceName: z.string().optional(),
  relevanceScore: z.number().min(0).max(1).optional(),
});
export type WebSearchResultItem = z.infer<typeof WebSearchResultItemSchema>;

export const MultiSourceCitationSchema = WebSearchResultItemSchema.extend({
  source: KnowledgeSourceTypeSchema,
  sourceName: z.string(),
  fetchedAt: z.string().datetime().optional(),
});
export type MultiSourceCitation = z.infer<typeof MultiSourceCitationSchema>;

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
  appId: z.string().min(1).optional(),
  appName: z.string().min(1),
  executablePath: z.string().optional(),
  trustedFastLaunch: z.boolean().optional(),
  reason: z.string().min(1),
});
export type ProposeOpenDesktopAppParam = z.infer<typeof ProposeOpenDesktopAppParamSchema>;

export const ProposeOpenWebsiteParamSchema = z.object({
  url: z.string().url(),
  browser: z.enum(['msedge', 'default']).default('msedge').optional(),
  reason: z.string().min(1),
});
export type ProposeOpenWebsiteParam = z.infer<typeof ProposeOpenWebsiteParamSchema>;

export const EdgeBrowserActionTypeSchema = z.enum([
  'open_new_tab',
  'switch_tab',
  'list_open_tabs',
  'read_active_page_summary',
  'media_control',
]);
export type EdgeBrowserActionType = z.infer<typeof EdgeBrowserActionTypeSchema>;

export const ProposeBrowserActionParamSchema = z.object({
  actionType: z.enum([
    'NAVIGATE',
    'NEW_TAB',
    'YOUTUBE_SEARCH',
    'YOUTUBE_PLAY_PAUSE',
    'INSPECT_PAGE',
    'open_new_tab',
    'switch_tab',
    'list_open_tabs',
    'read_active_page_summary',
    'media_control',
  ]),
  targetUrl: z.string().url().optional(),
  actionDetails: z.record(z.unknown()).default({}),
});
export type ProposeBrowserActionParam = z.infer<typeof ProposeBrowserActionParamSchema>;

export const EdgeOpenNewTabParamSchema = z.object({
  url: z.string().url(),
  active: z.boolean().default(true),
});
export type EdgeOpenNewTabParam = z.infer<typeof EdgeOpenNewTabParamSchema>;

export const EdgeSwitchTabParamSchema = z.object({
  tabId: z.union([z.number().int(), z.string()]).optional(),
  titleOrUrlMatch: z.string().min(1).optional(),
});
export type EdgeSwitchTabParam = z.infer<typeof EdgeSwitchTabParamSchema>;

export const EdgeListOpenTabsParamSchema = z.object({
  windowId: z.number().int().optional(),
});
export type EdgeListOpenTabsParam = z.infer<typeof EdgeListOpenTabsParamSchema>;

export const EdgeReadActivePageSummaryParamSchema = z.object({
  maxChars: z.number().int().min(100).max(20000).default(4000),
});
export type EdgeReadActivePageSummaryParam = z.infer<typeof EdgeReadActivePageSummaryParamSchema>;

export const EdgeMediaControlParamSchema = z.object({
  command: z.enum(['PLAY', 'PAUSE', 'TOGGLE', 'NEXT', 'PREVIOUS', 'MUTE', 'UNMUTE']),
  tabId: z.union([z.number().int(), z.string()]).optional(),
});
export type EdgeMediaControlParam = z.infer<typeof EdgeMediaControlParamSchema>;

export const EdgeBrowserTabSchema = z.object({
  id: z.union([z.number().int(), z.string()]),
  title: z.string(),
  url: z.string(),
  active: z.boolean().default(false),
  windowId: z.number().int().optional(),
  audible: z.boolean().optional(),
});
export type EdgeBrowserTab = z.infer<typeof EdgeBrowserTabSchema>;

export const WhatsAppSearchDownloadOpenParamSchema = z.object({
  query: z.string().min(1),
  contactOrGroup: z.string().optional(),
  fileTypes: z.array(z.string()).default(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 'xlsx']),
  openAfterDownload: z.boolean().default(true),
  openInEdge: z.boolean().default(true),
  reason: z.string().default('Search, download, and open document from WhatsApp or local Downloads'),
});
export type WhatsAppSearchDownloadOpenParam = z.infer<typeof WhatsAppSearchDownloadOpenParamSchema>;

export const WhatsAppCallParamSchema = z.object({
  contactName: z.string().min(1),
  phoneNumber: z.string().optional(),
  callType: z.enum(['VOICE', 'VIDEO']).default('VOICE'),
  reason: z.string().default('Initiate WhatsApp call via WhatsApp Desktop'),
});
export type WhatsAppCallParam = z.infer<typeof WhatsAppCallParamSchema>;

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
