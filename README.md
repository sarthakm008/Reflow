# CommitZero

> **Plan realistically. Recover intelligently. Keep progressing.**

An academic productivity application and intelligent plan recovery system tailored for college students managing demanding course loads, programming assignments, exam prep, and personal projects.

---

## 1. The Problem

College students frequently underestimate how long complex academic tasks take, construct overly ambitious and brittle schedules, procrastinate, and struggle to reorganize their workload when they inevitably fall behind.

Traditional to-do apps simply mark tasks as red and overdue, creating guilt rather than offering a structured path forward. CommitZero's core differentiator is **Plan Recovery**: when reality deviates from the plan, CommitZero deterministically recalculates a realistic, feasible schedule with transparent reasoning.

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
- **Persistence:** Browser `localStorage` with versioned schema keys, automated error recovery, and zero backend requirement
- **Testing:** Native Node.js test runner (`node:test` & `node:assert`)

---

## 4. Project Structure

```text
├── index.html                  # HTML entry point with metadata and fonts
├── package.json                # Dependencies and npm scripts
├── vite.config.js              # Vite configuration (pure JavaScript)
├── tests/
│   └── commitzero.test.js      # Automated unit test suite (18 unit tests)
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
        │   └── Sidebar.jsx     # Navigation and study budget capacity widget
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

### Prerequisites
- Node.js 18+ (Node 20+ recommended)
- npm or bun

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd commitzero

# Install dependencies
npm install

# Start development server (Port 3000)
npm run dev
```

### Running Automated Tests
```bash
npm test
```
Runs 18 unit tests across task validation, scheduling constraints, focus session timestamp tracking, recovery conflict detection, and analytics calculation.

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
5. CommitZero automatically opens **Plan Recovery**, calculates the new remaining workload, shows that Express.js (+60m) and a portion of MongoDB take priority over algorithms and lecture notes, provides transparent reasons, and presents the side-by-side preview.
6. Click **Accept Revised Plan** to apply the repaired schedule to your day.
7. Check the **Analytics** page to observe the recorded 90m session and updated estimation accuracy index.

---

## 8. Deployment

To deploy CommitZero on Vercel:
```bash
npm run build
```
Deploy the `dist/` folder as a standard Single Page Application (SPA). For static hosting platforms, set the build command to `npm run build` and output directory to `dist`.

---

## 9. Known Limitations

- **Single Device / Local Browser Scope:** All state is saved to the browser's `localStorage`. Syncing across multiple devices would require a remote database and authentication backend.
- **Single-Day Time Windows:** Schedule generation currently allocates time within a single calendar day window; multi-day project roadmapping is handled via deadline dates and daily rollover.
