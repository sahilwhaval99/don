export const ASSISTANT_STATUSES = [
  'offline',
  'ready',
  'listening',
  'thinking',
  'awaiting_approval',
  'running',
  'complete',
  'error',
] as const;

export type AssistantStatus = (typeof ASSISTANT_STATUSES)[number];

export const CAPABILITY_LABELS = [
  'Working',
  'Requires permission',
  'Requires local agent',
  'Simulated',
  'Unavailable',
] as const;

export type CapabilityLabel = (typeof CAPABILITY_LABELS)[number];

export const ALLOWED_TOOLS = [
  'web_search',
  'answer_from_connected_documents',
  'create_task',
  'update_task',
  'complete_task',
  'create_project',
  'update_goal',
  'create_reminder',
  'create_calendar_draft',
  'create_email_draft',
  'create_message_draft',
  'request_screen_capture',
  'analyze_user_shared_content',
  'propose_open_desktop_app',
  'propose_open_website',
  'propose_browser_action',
  'propose_phone_dial',
  'propose_phone_call',
  'create_automation_draft',
  'run_approved_automation',
  'pause_or_disable_automation',
] as const;

export type AllowedToolName = (typeof ALLOWED_TOOLS)[number];

export const ROUTINE_NAMES = [
  'Morning',
  'Work',
  'Study',
  'Driving',
  'Wind Down',
] as const;

export type RoutineName = (typeof ROUTINE_NAMES)[number];
