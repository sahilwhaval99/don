import { AllowedToolName, ApprovalConsequence } from '@don/shared';

export function evaluateConsequence(
  toolName: AllowedToolName,
  parameters: Record<string, unknown>
): { requiresApproval: boolean; consequence: ApprovalConsequence } {
  switch (toolName) {
    case 'web_search':
      return {
        requiresApproval: false,
        consequence: {
          target: String(parameters.query || 'Web Search'),
          description: 'Search external internet sources and return cited summaries.',
          isReversible: true,
          riskLevel: 'LOW',
          requiresLocalAgent: false,
          requiresAndroidCompanion: false,
        },
      };

    case 'answer_from_connected_documents':
      return {
        requiresApproval: false,
        consequence: {
          target: 'User Connected Documents',
          description: 'Query existing personal uploaded documents with semantic search.',
          isReversible: true,
          riskLevel: 'LOW',
          requiresLocalAgent: false,
          requiresAndroidCompanion: false,
        },
      };

    case 'create_task':
    case 'update_task':
    case 'complete_task':
    case 'create_project':
    case 'update_goal':
    case 'create_reminder':
      return {
        requiresApproval: false,
        consequence: {
          target: `Task/Goal Management: ${parameters.title || parameters.name || 'item'}`,
          description: 'Create or update tasks and goals in user workspace.',
          isReversible: true,
          riskLevel: 'LOW',
          requiresLocalAgent: false,
          requiresAndroidCompanion: false,
        },
      };

    case 'create_calendar_draft':
      return {
        requiresApproval: false,
        consequence: {
          target: `Calendar Draft: "${parameters.title || 'Draft Event'}"`,
          description: 'Create a calendar event draft. Does not send or publish without confirmation.',
          isReversible: true,
          riskLevel: 'LOW',
          requiresLocalAgent: false,
          requiresAndroidCompanion: false,
        },
      };

    case 'create_email_draft':
      return {
        requiresApproval: false,
        consequence: {
          target: `Email Draft to: ${Array.isArray(parameters.to) ? parameters.to.join(', ') : parameters.to || 'recipient'}`,
          description: 'Generate email draft. Does not send email to recipient.',
          isReversible: true,
          riskLevel: 'LOW',
          requiresLocalAgent: false,
          requiresAndroidCompanion: false,
        },
      };

    case 'create_message_draft':
      return {
        requiresApproval: false,
        consequence: {
          target: `Message Draft to: ${parameters.recipient || 'recipient'}`,
          description: 'Draft message text. Does not transmit message.',
          isReversible: true,
          riskLevel: 'LOW',
          requiresLocalAgent: false,
          requiresAndroidCompanion: false,
        },
      };

    case 'request_screen_capture':
      return {
        requiresApproval: true,
        consequence: {
          target: `Desktop Screen Window: ${parameters.windowTitleOrTarget || 'Current Screen'}`,
          description: 'Capture a transient image of your screen for immediate visual analysis. Deleted after session.',
          isReversible: false,
          riskLevel: 'HIGH',
          requiresLocalAgent: true,
          requiresAndroidCompanion: false,
        },
      };

    case 'analyze_user_shared_content':
      return {
        requiresApproval: false,
        consequence: {
          target: `Shared Content: ${parameters.contentType || 'file'}`,
          description: 'Analyze content explicitly provided by the user.',
          isReversible: true,
          riskLevel: 'LOW',
          requiresLocalAgent: false,
          requiresAndroidCompanion: false,
        },
      };

    case 'propose_open_desktop_app':
      return {
        requiresApproval: true,
        consequence: {
          target: `Desktop App: ${parameters.appName}`,
          description: `Launch allowlisted application "${parameters.appName}" via local Windows desktop agent.`,
          isReversible: false,
          riskLevel: 'MEDIUM',
          requiresLocalAgent: true,
          requiresAndroidCompanion: false,
        },
      };

    case 'propose_open_website':
      return {
        requiresApproval: true,
        consequence: {
          target: `External Website: ${parameters.url}`,
          description: `Open external browser tab navigating to: ${parameters.url}.`,
          isReversible: false,
          riskLevel: 'MEDIUM',
          requiresLocalAgent: false,
          requiresAndroidCompanion: false,
        },
      };

    case 'propose_browser_action':
      return {
        requiresApproval: true,
        consequence: {
          target: `Browser Extension Action: ${parameters.actionType}`,
          description: `Execute controlled browser action: ${parameters.actionType} on ${parameters.targetUrl || 'active tab'}.`,
          isReversible: false,
          riskLevel: 'MEDIUM',
          requiresLocalAgent: false,
          requiresAndroidCompanion: false,
        },
      };

    case 'propose_phone_dial':
      return {
        requiresApproval: true,
        consequence: {
          target: `Android Dialer: ${parameters.phoneNumber}${parameters.contactName ? ` (${parameters.contactName})` : ''}`,
          description: 'Send intent to Android companion to open dialer with populated number. Call is NOT placed automatically.',
          isReversible: true,
          riskLevel: 'MEDIUM',
          requiresLocalAgent: false,
          requiresAndroidCompanion: true,
        },
      };

    case 'propose_phone_call':
      return {
        requiresApproval: true,
        consequence: {
          target: `DIRECT PHONE CALL: ${parameters.phoneNumber}${parameters.contactName ? ` (${parameters.contactName})` : ''}`,
          description: 'Initiate direct phone call via Android CALL_PHONE permission after phone-side confirmation.',
          isReversible: false,
          riskLevel: 'CRITICAL',
          requiresLocalAgent: false,
          requiresAndroidCompanion: true,
        },
      };

    case 'create_automation_draft':
      return {
        requiresApproval: false,
        consequence: {
          target: `Automation Draft: ${parameters.name || 'New Automation'}`,
          description: 'Save draft automation recipe. Disabled until user reviews and enables.',
          isReversible: true,
          riskLevel: 'LOW',
          requiresLocalAgent: false,
          requiresAndroidCompanion: false,
        },
      };

    case 'run_approved_automation':
      return {
        requiresApproval: true,
        consequence: {
          target: `Automation Run: ${parameters.recipeId || 'Recipe'}`,
          description: 'Execute multi-step automation workflow.',
          isReversible: false,
          riskLevel: 'HIGH',
          requiresLocalAgent: false,
          requiresAndroidCompanion: false,
        },
      };

    case 'pause_or_disable_automation':
      return {
        requiresApproval: true,
        consequence: {
          target: `Disable Automation: ${parameters.recipeId || 'Recipe'}`,
          description: 'Deactivate or pause an active automation schedule.',
          isReversible: true,
          riskLevel: 'MEDIUM',
          requiresLocalAgent: false,
          requiresAndroidCompanion: false,
        },
      };

    default:
      return {
        requiresApproval: true,
        consequence: {
          target: 'Unknown Tool Action',
          description: 'Unrecognized action requires explicit confirmation.',
          isReversible: false,
          riskLevel: 'HIGH',
          requiresLocalAgent: false,
          requiresAndroidCompanion: false,
        },
      };
  }
}
