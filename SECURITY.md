# Security Architecture & Threat Model

> **DON (Digital Operations Navigator) Security Specification**

DON is engineered under the assumption that an AI assistant operating across multiple physical devices represents a critical trust boundary. It adheres strictly to the **Principle of Least Privilege**, **Explicit Human-in-the-Loop Consent for Consequential Actions**, and **Zero Stealth Execution**.

---

## 1. Threat Model & Boundaries

| Component | Trust Level | Security Boundary Enforcement |
|-----------|-------------|-------------------------------|
| **Web Frontend (GitHub Pages)** | Untrusted Public Static Host | Static HTML/JS only. No secrets stored. All state and mutations must flow through authenticated API calls with Bearer JWT tokens. |
| **API Server (Cloud Run)** | Trusted Core | Validates Zod request schemas, enforces rate limits (120 req/min), verifies JWT signatures, and manages audit trails. |
| **Windows Desktop Agent (Tauri)** | High-Privilege Workstation | Executes only user-allowlisted binaries at fixed, normalized file paths. Rejects shell access, remote scripts, and path traversal. |
| **Android Companion (Kotlin)** | Personal Mobile Device | Pairs via one-time cryptographically generated tokens. Telephony and dialer intents require phone-side approval. |
| **Browser Extension (MV3)** | Sandbox Isolation | Minimal permission scope (`activeTab`, `tabs`, YouTube host). Prevents cross-origin DOM scraping without consent. |
| **AI Provider Layer** | Semi-Trusted Advisory | Proposes structured tool actions only. Has **zero authority** to execute sensitive or consequential tools directly. |

---

## 2. Consequential Action Approval Framework

Every tool proposed by the AI provider is evaluated by `evaluateConsequence` in `@don/ai` against a deterministic risk taxonomy:

```
[User Chat / Voice Prompt]
           │
           ▼
[AI Model Proposes Typed Tool Schema]
           │
           ▼
[Consequence Engine Evaluates Risk]
    ├── LOW RISK (web_search, create_task, document_rag, drafts)
    │     └── Executed immediately -> Logged to Audit Center
    │
    └── HIGH / CRITICAL RISK (open_desktop_app, screen_capture, propose_phone_call)
          ├── Tool execution suspended in PENDING state
          ├── Consequence details (target, reversible, risk) rendered in Approval Card
          ├── Notification broadcast to target companion device
          │
          ├── [User Confirms] ──> Dispatched to device daemon -> Executed -> Logged
          └── [User Denies]   ──> Cancelled -> Status DENIED -> Logged to Audit Center
```

### Prohibited Capabilities
DON explicitly forbids:
- Arbitrary command shell or PowerShell execution (`cmd.exe /c`, `powershell -c`, etc.).
- Remote code execution (RCE) or arbitrary script download/execution.
- Stealth audio recording or persistent screen surveillance.
- Contact list scraping or address book exfiltration.
- Lock-screen bypass or hidden background calling.

---

## 3. Desktop Companion Security & Allowlisting

The Windows desktop agent enforces app allowlisting at two layers:
1. **TypeScript Daemon Layer (`apps/desktop-agent/src/allowlist.ts`)**:
   - Compares requested application name against user-registered allowlist entries.
   - Normalizes path using `path.normalize(fixedPath)` to detect path traversal (`../`) and unauthorized binaries.
   - Rejects execution if binary path deviates from the registered target.
2. **Native Rust Layer (`apps/desktop-agent/src-tauri/src/main.rs`)**:
   - Tauri command handler verifies that `user_approved == true`.
   - Employs hardcoded native match guards to prevent command parameter injection.

### Ephemeral Screen Capture Policy
- Screen capture sessions require explicit active consent for every session (`userGrantedConsent === true`).
- The desktop agent displays an active sharing banner during capture.
- Screen buffers are held purely in transient memory buffers (`Buffer | null`).
- Calling `stopSharing()` immediately wipes the transient buffer and sets the reference to `null`, ensuring **zero persistent image retention**.

---

## 4. Android Companion Telephony Safety

The companion app supports two tiers of telephony integration:
1. **Dialer Proposal (`Intent.ACTION_DIAL`) [Default]**:
   - Pre-populates the phone's native dialer with the target phone number.
   - The user must explicitly inspect the number and press Call on their handset.
   - Does not require `CALL_PHONE` permission.
2. **Direct Calling (`Intent.ACTION_CALL`) [Optional / Protected]**:
   - Requires explicit runtime `android.permission.CALL_PHONE` consent.
   - Displays a dedicated confirmation modal informing the user of direct call invocation.
   - If the user denies runtime permission, the app automatically and safely degrades to `Intent.ACTION_DIAL`.
   - Wi-Fi calling routing and carrier network transport remain strictly governed by the Android OS and carrier provisioning. DON cannot force or override carrier routing.

---

## 5. Authentication & Token Management

- **Access Tokens**: Short-lived (15 minutes / 900 seconds) JWT access tokens.
- **Refresh Token Rotation**: Refresh tokens are single-use, cryptographically generated random hex strings (40 bytes / 80 characters). Upon refresh, the previous refresh token is immediately revoked in the database.
- **Password Security**: Passwords hashed using bcrypt with work factor salt (10 rounds).
- **Pairing Handshake**: Devices pair using ephemeral 8-character tokens with 15-minute expirations and optional Ed25519 public key verification.

---

## 6. Emergency Kill Switch Architecture

The Emergency Kill Switch is a system-wide hardware/software interlock:
- Engaging the kill switch immediately sets `db.killSwitch.isActivated = true`.
- Broadcasts high-priority `KILL_SWITCH_TRIGGERED` payload via WebSocket relay to all connected devices.
- **Desktop Agent**: Immediately wipes screen capture buffers and blocks all app launch commands.
- **Android Companion**: Immediately cancels all active and pending notification alerts.
- **API Server**: Blocks any approval decisions (`POST /api/approvals/:id/decide` returns HTTP 403) and disables chat tool execution.
- All kill switch activations and deactivations are permanently committed to the immutable audit log with user identity and timestamp.
