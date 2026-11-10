# DON (Digital Operations Navigator)

> **Enterprise-Grade, Secure, Privacy-Respecting Multi-Device AI Assistant**

DON is a production-oriented, permission-first AI operations assistant engineered for authenticated power users. DON coordinates tasks, projects, personal routines, semantic document knowledge, desktop actions, and companion devices while enforcing hard security boundaries, strict consequence approval gates, transparent citations, and an emergency kill switch.

---

## Architecture & Monorepo Structure

```
don/
├── apps/
│   ├── web/                 Next.js 14 static-export frontend dashboard (GitHub Pages ready)
│   ├── api/                 Fastify REST & WebSocket backend API (Cloud Run ready)
│   ├── desktop-agent/       Windows-first Tauri companion daemon with native executable allowlist
│   ├── android/             Kotlin Android companion app (Android 10+, dialer & push approvals)
│   └── browser-extension/   Manifest V3 Chrome/Edge extension with tab & YouTube media controls
├── packages/
│   ├── shared/              Zod schemas, types, and unified command definitions
│   ├── ui/                  Shared dark-mode UI components (StatusOrb, ApprovalCard, KillSwitchBanner)
│   ├── ai/                  AI provider abstraction (MockAIProvider & Gemini), RAG analyzer, search engine
│   └── config/              Shared TypeScript and ESLint configurations
├── tests/
│   ├── e2e/                 End-to-end operator workflow test suite
│   ├── desktop/             Desktop companion allowlist, capture, and kill switch tests
│   └── android/             Android companion pairing, dialer fallback, and notification tests
├── scripts/
│   ├── verify-all.ts        Orchestrator for all 10 verification rounds
│   ├── verify-round.ts      Single round executor (1–10)
│   └── verify-docker.ts     Cloud Run container validation probe
├── cloudbuild.yaml          Google Cloud Build pipeline for Cloud Run
└── .github/workflows/
    ├── ci.yml               Full continuous integration pipeline running all 10 rounds
    └── deploy-pages.yml     Static Next.js export build & deploy to GitHub Pages
```

---

## Core Product Capabilities

1. **Dashboard & Status Orb**:
   - Amber/gold dark theme (#f59e0b) with high visual polish.
   - 8-state Assistant Status Orb: `offline`, `ready`, `listening`, `thinking`, `awaiting approval`, `running`, `complete`, `error`.
   - Prominent **Stop all automations** emergency kill switch banner.

2. **Personal Knowledge & Semantic Document RAG**:
   - Opt-in long-term encrypted memory store with explicit storage rationales.
   - In-memory/Postgres document indexing with chunking and lexical/semantic search.
   - Structured citations displaying source document name, section/page, confidence score, and verified snippet.

3. **Tasks, Projects, Goals & Routines**:
   - Priority task manager with labels, subtasks, due dates, and dependencies.
   - Goals tracker with target dates, milestones, blockers, and weekly reviews.
   - Daily briefing generator (calendar, urgent tasks, overdue items, focus block recommendation).
   - Focus Mode initiating session timer and suppressing eligible notifications.

4. **Desktop Agent (Windows Tauri)**:
   - Strict application allowlist enforcing fixed executable binaries (Calculator, Notepad, Paint, etc.).
   - Explicit rejection of arbitrary shell commands, PowerShell scripts, and relative path traversal.
   - Transient screen capture with active sharing indicator and immediate buffer wipe upon session termination.

5. **Android Companion**:
   - QR code / one-time token pairing with cryptographic handshake.
   - Push notifications for task reminders and consequential approval requests.
   - Safe dialer intent (`Intent.ACTION_DIAL`) proposal.
   - Optional direct calling (`Intent.ACTION_CALL`) governed strictly by runtime `CALL_PHONE` consent.
   - Emergency kill switch signal clears all pending phone alerts immediately.

6. **Browser Extension (Manifest V3)**:
   - Minimal permissions (`tabs`, `activeTab`, YouTube host permissions).
   - Controlled navigation, new tab opening, YouTube search, and play/pause toggle.

---

## Platform Truths & Architecture Guardrails

- **GitHub Pages Limitation**: GitHub Pages hosts only the static frontend export (`apps/web/out`). All API calls, authentication, database storage, and AI relay require the Cloud Run backend API.
- **Desktop Security Boundary**: A browser cannot execute native host commands. DON delegates workstation actions strictly to the local Tauri companion agent via mutual WebSocket relay.
- **Carrier Routing on Android**: Direct calls or dialer intents launched by the Android companion remain governed by OS telephony frameworks and carrier network conditions (including Wi-Fi calling routing). DON does not alter carrier routing.
- **Zero Stealth Policy**: No background microphone scraping, no silent phone dialing, no stealth screen recording, and no hidden process execution.

---

## Quickstart & Commands

### Prerequisites
- Node.js >= 20.x
- pnpm >= 9.x / 12.x

### 1. Installation
```bash
pnpm install
```

### 2. Run Verification Suite (All 10 Rounds)
```bash
pnpm run verify
```

### 3. Run Individual Rounds
```bash
pnpm run verify:1    # Clean dependency install
pnpm run verify:2    # Type check all workspaces
pnpm run verify:3    # Lint all workspaces
pnpm run verify:4    # Unit test suite
pnpm run verify:5    # API integration tests with disposable database
pnpm run verify:6    # Static web build & GitHub Pages export check
pnpm run verify:7    # Docker container & Cloud Run health-check test
pnpm run verify:8    # End-to-end user flow test
pnpm run verify:9    # Desktop mock test suite
pnpm run verify:10   # Android companion mock test suite
```

### 4. Local Development
```bash
# Build shared packages
pnpm run build

# Start API backend
pnpm --filter @don/api run dev

# Start Web Dashboard
pnpm --filter @don/web run dev
```

---

## Deployment Instructions

### Static Frontend (GitHub Pages)
The GitHub Actions workflow at `.github/workflows/deploy-pages.yml` automatically builds the Next.js static export and publishes `apps/web/out` to GitHub Pages upon pushes to `main`.

### Backend API (Google Cloud Run)
Run with Google Cloud Build:
```bash
gcloud builds submit --config cloudbuild.yaml .
```
Or build locally with Docker:
```bash
docker build -f apps/api/Dockerfile -t gcr.io/$PROJECT_ID/don-api:latest .
docker run -p 8080:8080 -e DATABASE_URL="postgresql://..." gcr.io/$PROJECT_ID/don-api:latest
```
Test health check:
```bash
curl http://localhost:8080/health
# Response: {"status":"healthy","uptimeSeconds":...,"version":"1.0.0","killSwitchActive":false}
```

---

## Companion Setup Instructions

### Desktop Companion (Tauri)
1. Install Rust (`rustup default stable`) and Microsoft Visual C++ Build Tools.
2. Navigate to `apps/desktop-agent`:
   ```bash
   cd apps/desktop-agent
   pnpm install
   pnpm exec tauri dev
   ```
3. Register permitted executables via dashboard or `allowlist.ts`.

### Android Companion
1. Open `apps/android` in Android Studio Ladybug or newer.
2. Build and run on an Android 10+ (API 29+) device or emulator.
3. Open DON Web Dashboard -> Connected Devices -> Pair Android Companion.
4. Scan the QR code or enter the 8-character hex pairing token in the app.

### Browser Extension (Chrome / Edge Manifest V3)
1. Build the extension package:
   ```bash
   pnpm --filter @don/browser-extension run build
   ```
2. Open Chrome or Edge and navigate to `chrome://extensions` or `edge://extensions`.
3. Enable **Developer mode** toggle in the top-right corner.
4. Click **Load unpacked** and select the directory: `apps/browser-extension`.
5. The DON Browser Companion icon will appear in the toolbar. Click to open the companion popup and view relay status.

---

## PostgreSQL Migrations & Backup Procedures

### Prisma Database Migrations
Prisma manages all relational schema migrations targeting PostgreSQL on Cloud SQL, Supabase, Neon, or local Docker containers:
```bash
# Apply pending migrations to database
pnpm --filter @don/api exec prisma migrate deploy

# Generate Prisma Client after schema changes
pnpm --filter @don/api exec prisma generate
```

### Database Backup & Disaster Recovery
1. **Automated Logical Backup (pg_dump)**:
   ```bash
   pg_dump -h $DB_HOST -U $DB_USER -d don_db -F c -b -v -f don_backup_$(date +%Y%m%d_%H%M%S).dump
   ```
2. **Point-in-Time Recovery**:
   When using Google Cloud SQL for PostgreSQL, automated daily backups with transaction log retention enable point-in-time recovery (PITR) to any second within the retention window.
3. **Database Restore**:
   ```bash
   pg_restore -h $DB_HOST -U $DB_USER -d don_db -v -c don_backup.dump
   ```
