# DON Capability Matrix

> **Comprehensive Status Matrix of DON Capabilities**

This matrix reflects the implemented state of DON across all platforms, client companion agents, and services. Each capability is classified into one of five standard statuses:

- **Working**: Fully implemented, tested, and operational.
- **Requires local installation**: Functional when the local companion agent (Desktop or Android) is installed and paired.
- **Requires permission**: Functional upon user granting explicit permission (runtime consent or approval card).
- **Simulated / Mock-only**: Operational in mock mode for testing and local verification without paid external credentials.
- **Unavailable / Not supported**: Intentionally unsupported due to platform truth, OS security, or privacy guarantees.

---

## 1. Core Assistant & Platform Experience

| Feature | Status | Notes |
|---------|--------|-------|
| Dark Dashboard with Amber Accents | **Working** | Implemented in Next.js static export with Tailwind tokens. |
| Assistant Status Orb (8 States) | **Working** | Offline, Ready, Listening, Thinking, Awaiting Approval, Running, Complete, Error. |
| Emergency Kill Switch Banner & Interlock | **Working** | Global halt for automations, screen sharing, app launching, and tool execution. |
| Static Frontend Hosting on GitHub Pages | **Working** | Exported via `output: 'export'` to `apps/web/out`. Zero server-side runtime dependency. |
| Fastify REST & WebSocket Backend on Cloud Run | **Working** | Dockerfile multi-stage build, port 8080 compliance, `/health` endpoint verified. |
| Audit Center Logging & GDPR Data Export | **Working** | Full audit trail of proposals, approvals, denials, and JSON account export. |

---

## 2. Artificial Intelligence & Knowledge Retrieval

| Feature | Status | Notes |
|---------|--------|-------|
| AI Provider Abstraction Interface | **Working** | Common contract (`AIProvider`) for mock, Gemini, and future providers. |
| Deterministic Mock AI Provider | **Working** | Proposes schema-validated tools, parses prompt intents, returns citations. |
| Gemini AI Provider Adapter | **Working** | Connects to Google Gemini API when `GEMINI_API_KEY` is provided. |
| Consequence & Consequential Risk Evaluator | **Working** | Classifies actions into LOW, MEDIUM, HIGH, and CRITICAL risks. |
| Web Search Citation Engine | **Working** | Returns URL, title, publication date, and uncertainty score (Mock & Tavily adapter). |
| Semantic Document RAG with Citations | **Working** | Chunks uploaded documents, indexes text, and provides page/section citations. |
| Meeting Mode Summarizer | **Working** | Analyzes imported transcripts into decisions, tasks, and follow-up drafts. |
| Research Mode Engine | **Working** | Multi-source comparison, claim synthesis, and agreement/disagreement analysis. |
| Opt-in Long-term Encrypted Memory | **Working** | Stores personal facts, preferences, and routines with explicit storage rationales. |

---

## 3. Operations: Tasks, Goals, Routines & Focus Mode

| Feature | Status | Notes |
|---------|--------|-------|
| Tasks & Subtasks CRUD | **Working** | Priority, due dates, timezone, labels, dependencies, recurring cron. |
| Goals & Milestones Tracking | **Working** | Target dates, progress percentage, blockers, and weekly reviews. |
| Daily Briefing Generation | **Working** | Combines calendar drafts, urgent tasks, overdue items, and weather. |
| Focus Mode Session Initiation | **Working** | Starts focus timer, defines allowlisted tools, and mutes non-essential alerts. |
| Calendar Event Draft Creation | **Working** | Previews calendar drafts without auto-publishing to external services. |
| Email & Message Draft Generation | **Working** | Creates editable drafts; never sends emails without final user confirmation. |

---

## 4. Desktop Agent (Windows Workstation)

| Feature | Status | Notes |
|---------|--------|-------|
| Workstation Pairing & WebSocket Relay | **Requires local installation** | Connects Tauri daemon with backend API relay. |
| Allowlisted Application Launch | **Requires permission** | Launches Calculator, Notepad, etc., strictly after user confirmation. |
| Path Traversal / Shell Script Injection Defense | **Working** | Rejects path tampering, unregistered binaries, PowerShell, and bash commands. |
| Ephemeral Screen Capture Session | **Requires permission** | Requires active session consent; zero-retention memory buffer wiped on stop. |
| Arbitrary Shell / Terminal Execution | **Unavailable / Not supported** | Explicitly disallowed by architecture to prevent remote code execution. |
| Hidden Screen Surveillance | **Unavailable / Not supported** | Active sharing indicator is mandatory; no background capture. |

---

## 5. Android Companion (Mobile)

| Feature | Status | Notes |
|---------|--------|-------|
| One-time Token / QR Pairing | **Requires local installation** | Cryptographic token handshake over local mDNS or Cloud Relay. |
| Push Notifications & Task Reminders | **Requires permission** | Requires Android 13+ `POST_NOTIFICATIONS` runtime permission. |
| Action Approval Cards on Handset | **Requires local installation** | Approve/Reject action buttons in notification tray and dashboard. |
| Safe Phone Dialer Proposal | **Requires permission** | Opens native dialer via `Intent.ACTION_DIAL` with pre-filled number. |
| Direct Phone Call (`CALL_PHONE`) | **Requires permission** | Requires explicit `android.permission.CALL_PHONE` grant and user approval. |
| Wi-Fi Calling Routing Override | **Unavailable / Not supported** | Carrier and Android telephony settings dictate cellular vs. Wi-Fi routing. |
| Stealth Call Dialing / Contact Scraping | **Unavailable / Not supported** | Prohibited by DON security policy. |
| iOS Native Direct Calling | **Unavailable / Not supported** | iOS sandboxing prevents background direct call placement; dialer deep-link only. |

---

## 6. Browser Companion Extension

| Feature | Status | Notes |
|---------|--------|-------|
| New Tab Opening & Navigation | **Requires permission** | Manifest V3 extension opening approved URLs upon confirmation. |
| YouTube Media Control (Play/Pause) | **Requires permission** | Dispatches content script messages to YouTube player tabs. |
| YouTube Search | **Working** | Formats and opens search query in new YouTube tab. |
| Arbitrary Web Page DOM Scraping | **Unavailable / Not supported** | Minimal permission extension limits cross-origin DOM access. |
