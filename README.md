# Reflow

> **Plan realistically. Recover intelligently. Keep progressing.**

An academic productivity application and intelligent plan recovery system tailored for college students managing demanding course loads, programming assignments, exam prep, and personal projects.

---

## 1. The Problem

College students frequently underestimate how long complex academic tasks take, construct overly ambitious and brittle schedules, procrastinate, and struggle to reorganize their workload when they inevitably fall behind.

Traditional to-do apps simply mark tasks as red and overdue, creating guilt rather than offering a structured path forward. Reflow's core differentiator is **Plan Recovery**: when reality deviates from the plan, Reflow deterministically recalculates a realistic, feasible schedule with transparent reasoning.

---

## 2. Key Features

1. **Dashboard**
   - Live date, collegiate greeting, and instant workload feasibility assessment.
   - Immediate detection of capacity shortfalls (e.g., 480 minutes of queued work vs 180 minutes of study budget).
   - Recommended next focus session with 1-click launcher.
   - Chronological agenda of today's schedule blocks.
   - Upcoming and overdue deadline radar.

2. **Task Manager**
   - Full CRUD task operations with subject categories (Computer Science, Math, Systems, Web Dev, etc.).
   - Multi-state lifecycle: `Pending`, `In Progress`, `Completed`.
   - Real-time search, sorting (Deadline, Priority, Duration, Creation date), and filter tabs (`All`, `Pending`, `In Progress`, `Completed`, `Overdue`, `Due Soon`).
   - Task validation ensuring positive durations, valid deadlines, and duration ceilings (≤ 24 hours).
   - Deleting tasks preserves historical focus session logs for analytics integrity.

3. **Deterministic Daily Planner**
   - Configurable study window (start time, end time, maximum daily focus budget, buffer breaks, unavailable periods like meals or lectures).
   - Transparent heuristic scheduling: prioritizes approaching deadlines and high-priority items.
   - Non-overlapping chronological time blocks.
   - Explicit identification of unallocated tasks with plain-English deferral rationale.
   - Split sessions when a task partially fits before daily budget exhaustion.

4. **Focus Workspace**
   - Deep work timer with timestamp-based time tracking (`Date.now()` delta), immune to inactive browser tabs or reloads.
   - Session lifecycle controls: Start, Pause, Resume, Finish, Cancel. Paused time is strictly excluded.
   - Post-session reflection dialog: prompts whether work remains or task took longer, allowing instant input of remaining work minutes and direct handoff to Plan Recovery.

5. **Plan Recovery Engine (Core Differentiator)**
   - 8-Step recovery analysis triggered by task overruns, unfinished sessions, skipped blocks, or reduced availability.
   - Calculates exact remaining workload without double-counting completed work.
   - Side-by-side comparison: *Current Plan (Unrecovered)* vs *Proposed Revised Plan*.
   - Explains every deferral, timing shift, split, and deadline risk with transparent algorithmic rationale.
   - Requires explicit user approval before applying changes to the active schedule.

6. **Productivity Analytics & Telemetry**
   - Grounded calculations from real recorded sessions and task histories.
   - Estimation Accuracy Index (actual work / planned work) highlighting student underestimation patterns.
   - 7-Day focus minutes distribution visualizer.
   - Subject-level work distribution and comparative task estimation vs actual duration variance table.
   - Historical focus session log.

---

## 3. Technology Stack

- **Framework:** React 19 (SPA on Vite)
- **Language:** **JavaScript (ES Modules) & JSX only** (Strictly zero TypeScript)
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Persistence:** Guest mode uses browser `localStorage`; authenticated accounts use the Express API and MongoDB, with local caching for continuity
- **Testing:** Native Node.js test runner (`node:test` & `node:assert`)

---

## 4. Project Structure

```text
├── index.html                  # HTML entry point with metadata and fonts
├── package.json                # Dependencies and npm scripts
├── vite.config.js              # Vite configuration (pure JavaScript)
├── tests/
│   └── commitzero.test.js      # Automated regression test suite (36 tests)
└── src/
    ├── main.jsx                # React DOM mounting entry point
    ├── App.jsx                 # Top-level shell and view router
    ├── index.css               # Tailwind CSS imports
    ├── context/
    │   └── AppContext.jsx      # Central state, localStorage sync, actions
    ├── models/
    │   ├── taskModel.js        # Task entity, validation, status rules
    │   └── sessionModel.js     # Focus session entity, timestamp calculations
    ├── engine/
    │   ├── scheduler.js        # Deterministic chronological scheduling engine
    │   ├── recovery.js         # 8-step intelligent plan recovery system
    │   └── analytics.js        # Statistical metrics & estimation ratio engine
    ├── utils/
    │   ├── storage.js          # LocalStorage abstraction with versioning
    │   └── sampleData.js       # Section 16 college student demonstration fixtures
    └── components/
        ├── common/
        │   ├── Navbar.jsx      # Header with active session ticker & demo menu
        │   └── Sidebar.jsx     # Navigation, staleness indicator & budget widget
        ├── dashboard/
        │   └── DashboardView.jsx # Primary command center & overload warnings
        ├── tasks/
        │   ├── TaskManagerView.jsx # Task list, filters, search, and sorting
        │   └── TaskFormModal.jsx   # Create & edit task modal
        ├── planner/
        │   └── PlannerView.jsx # Daily availability & chronological blocks
        ├── focus/
        │   └── FocusWorkspaceView.jsx # Distraction-free timer & post-session dialog
        ├── recovery/
        │   └── PlanRecoveryView.jsx   # Side-by-side recovery preview & controls
        └── analytics/
            └── AnalyticsView.jsx      # Telemetry, 7-day chart, and variance tables
```

---

## 5. Local Setup & Development

Reflow now supports a separate Express API and MongoDB persistence for authenticated accounts. Guest mode remains local-first and continues to use browser `localStorage`.

### Prerequisites
- Node.js 20 or newer
- npm
- MongoDB Community Server running locally, or a MongoDB Atlas database URI

### Frontend setup
From the repository root:

```powershell
npm install
npm run dev
```

The frontend runs at `http://localhost:3000`. During development, Vite proxies `/api` requests to `http://localhost:4000` by default.

### Backend setup
Open a second PowerShell terminal:

```powershell
cd server
Copy-Item .env.example .env
npm install
```

Edit `server/.env` and configure `MONGODB_URI` and `JWT_SECRET`. The JWT secret must be at least 32 characters. Start MongoDB before starting the API.

```powershell
npm run dev
```

The API runs at `http://localhost:4000`. Verify it at `http://localhost:4000/api/health`. A healthy response reports `status: "ok"` and a connected database; if MongoDB is unavailable, the endpoint returns HTTP 503 and reports `status: "degraded"`.

### Authentication and account data
- Registration and login use an HttpOnly, SameSite=Lax cookie.
- Passwords are hashed with bcrypt; password hashes are never returned by API endpoints.
- Tasks, focus sessions, preferences, and daily plans are scoped to the authenticated account.
- On first registration, existing local tasks and session history are automatically imported if the new account has no cloud data. Signing into an existing account does not automatically import data from another account on that browser.
- Guest mode remains available; guest data stays in that browser's local storage.

### Backend commands from the repository root
```powershell
npm run server:install
npm run server:dev
npm run server:test
npm run server:lint
```

To run the backend directly, use `cd server` followed by `npm install` and `npm run dev`.



### Prerequisites
- Node.js 18+ (Node 20+ recommended)
- npm

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd reflow

# Install dependencies
npm install

# Start development server (Port 3000)
npm run dev
```

### Running Automated Tests
```bash
npm test
```
Runs 36 current regression tests across:
1. **Task Model & Validation:** Title requirements, positive durations, 24h ceiling, remaining duration calculations.
2. **Scheduling Engine:** Feasibility, overload detection, priority scoring, non-overlapping blocks, completed tasks excluded, tasks without deadlines, unavailable periods, strict separation of `partiallyScheduledTasks` and `unscheduledTasks`, study window validation (start < end), zero capacity handling, and work interval chunking with rest breaks.
3. **Focus Session Tracking:** Accurate timestamps (`Date.now()`), paused time exclusion, documented rounding policy (≥30s rounds to 1m, <30s discarded), clean cancellation policy, and resilience against deleted tasks.
4. **Split-Task Semantics & Recovery Consistency (Section 2):** Partial allocation acceptance, full allocation acceptance, regeneration idempotency, partial work completion, focus session completion, planned vs actual work distinction in analytics, completed tasks excluded from recovery.
5. **Recovery Rejection (Section 3):** Declining a proposal leaves original schedule, tasks, and history 100% unaltered, clears the proposal, and redirects to planner.
6. **Schedule Invalidation (Section 4):** Task creation, editing duration/priority/deadline, deleting tasks, completing tasks, and reopening tasks flag schedule staleness with clear 1-click recalculation cues.
7. **Local Storage Resilience (Section 7):** Safe JSON parsing fallback, legacy unversioned key migration, and quota error handling.

### Linting
```bash
npm run lint
```
Performs syntax validation on all JavaScript engine modules and test files via `node --check`.

### Production Build
```bash
npm run build
```

---

## 6. How the Algorithms Work

### Scheduling Algorithm (`src/engine/scheduler.js`)
1. **Filtering:** Selects all incomplete tasks (`status !== 'Completed' && remainingDurationMinutes > 0`).
2. **Urgency Scoring:** Each task receives a composite score:
   $$\text{Composite Score} = \text{Deadline Urgency} + (\text{Priority Weight} \times 12) + \text{Overdue Bonus}$$
   - Overdue tasks receive $+100$.
   - Due within 24 hours receives $+60$.
   - Due within 48 hours receives $+40$.
   - Priority weights: High = 3, Medium = 2, Low = 1.
3. **Capacity Partitioning:** Chronologically walks through the day from `startTime` to `endTime`.
4. **Collision Avoidance:** Automatically skips configured unavailable periods (e.g. lunch or lectures) and injects scheduled breaks.
5. **Overload Capping:** When the total remaining work exceeds the student's study budget, the engine stops allocating lower-priority tasks, attempts partial split blocks if feasible, and records explicit reasons for every unscheduled item.

### Plan Recovery Algorithm (`src/engine/recovery.js`)
1. **Step 1 (Inspection):** Examines completed tasks, unfinished tasks, active sessions, and remaining time today.
2. **Step 2 (Workload Recalculation):** Sums only true remaining minutes; excludes completed work and deducts elapsed active focus time from daily study limits.
3. **Step 3 (Candidate Revision):** Re-runs priority sorting with adjusted time windows starting from the current time.
4. **Step 4 (Conflict & Delta Detection):** Identifies tasks dropped from today's plan, split sessions, and timing shifts.
5. **Step 5 (Transparent Explanations):** Generates natural explanations for each decision based on deadlines and priority.
6. **Step 6 (Preview Diff):** Creates side-by-side comparison between the original schedule and proposed revision.
7. **Step 7 & 8 (Decision & Application):** Requires explicit user confirmation before writing changes to the active daily plan.

---

## 7. Primary End-to-End Demonstration (Section 16)

To test the official scenario:
1. Click the **Demo Scenarios** button in the top navigation bar.
2. Select **Load 4-Task Overloaded Scenario**:
   - *Revise Express.js*: 120m, due tomorrow, High Priority.
   - *Complete a MongoDB assignment*: 180m, due tomorrow, High Priority.
   - *Practice algorithms*: 120m, due in 3 days, Medium Priority.
   - *Revise lecture notes*: 60m, due in 2 days, Medium Priority.
   - Daily available study budget: **180 minutes**.
3. Observe the immediate **Workload Overload Alert**: 480m of work queued vs 180m budget (+300m deficit).
4. Click **Simulate 90m Work (+60m needed)** or run a session in the Focus Workspace and log that the task requires another 60m.
5. Reflow automatically opens **Plan Recovery**, calculates the new remaining workload, shows that Express.js (+60m) and a portion of MongoDB take priority over algorithms and lecture notes, provides transparent reasons, and presents the side-by-side preview.
6. Click **Accept Revised Plan** to apply the repaired schedule to your day.
7. Check the **Analytics** page to observe the recorded 90m session and updated estimation accuracy index.

---

## 8. Deployment

To deploy Reflow on Vercel:
```bash
npm run build
```
Deploy the `dist/` folder as a standard Single Page Application (SPA). For static hosting platforms, set the build command to `npm run build` and output directory to `dist`.

---

## 9. Known Limitations

- **Single Device / Local Browser Scope:** All state is saved to the browser's `localStorage`. Syncing across multiple devices would require a remote database and authentication backend.
- **Single-Day Time Windows:** Schedule generation currently allocates time within a single calendar day window; multi-day project roadmapping is handled via deadline dates and daily rollover.

---

## Run Reflow locally (Windows)

### 1. Install frontend dependencies

From the project root:

```powershell
npm ci
```

### 2. Configure the backend

```powershell
cd server
Copy-Item .env.example .env
npm install
```

Edit `server/.env`. Set `MONGODB_URI` to your local MongoDB or MongoDB Atlas connection string, and set `JWT_SECRET` to a random secret of at least 32 characters. Keep `.env` private and out of Git.

Start MongoDB before starting the API. In the `server` folder, run:

```powershell
npm run dev
```

The API listens on port 4000. Check `http://localhost:4000/api/health` to verify database status.

### 3. Start the frontend

Open a second terminal in the project root and run:

```powershell
npm run dev
```

Open `http://localhost:3000`.

### 4. Test

From the project root:

```powershell
npm test
npm run lint
npm run build
npm run server:test
npm run server:lint
```

Backend API routes are in `server/routes/`, request handlers in `server/controllers/`, Mongoose schemas in `server/models/`, and the backend entry point is `server/index.js`.
