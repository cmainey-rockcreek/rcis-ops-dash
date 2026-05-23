# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

There is **no build step**. The app is loaded directly in the browser: `index.html` pulls React 18, ReactDOM, `@babel/standalone`, and `@supabase/supabase-js` from unpkg, then loads every local `.jsx` via `<script type="text/babel">` and every `.js` as a plain script tag. Babel transpiles JSX in the browser on each page load.

- Dev server: `python3 -m http.server 4173` from the repo root (matches `.claude/launch.json`), then open `http://localhost:4173`.
- Deploy: static site on Vercel (`vercel.json` enables clean URLs).
- There is no test suite, no linter, no `package.json`, and no node_modules.

Because there is no bundler, **script load order in `index.html` matters** — shared/router/auth must load before stores, stores before pages. When adding a new file, register it in `index.html` in the right position (`.jsx` files get `type="text/babel"`; plain `.js` does not).

The app is sized for ≥1440px; `#root` has `min-width: 1280px` and the page allows horizontal scroll rather than reflow below that.

## Tracking work — SPEC.md

`SPEC.md` is the forward-only plan: it lists only what is **not done yet** — upcoming work, open questions, and the parking lot. It is not a status archive. Git history is the record of what shipped.

Two rules, every run:

1. **When you finish an item, delete it from SPEC.md in the same commit that ships the work.** Not a separate commit, not a checkbox — remove the item. The commit that adds the feature is the commit that drops it from the plan, so the two cannot drift.
2. **When you discover new work, add it to SPEC.md** under the relevant section instead of doing it silently or dropping it.

At every phase or run boundary, reconcile: compare `git log` since the last boundary against SPEC.md and fix any mismatch before continuing.

## Architecture

### Module system: globals on `window`

There are no ES modules, no imports/exports. Every file is an IIFE that attaches its exports to `window`:

- Data: `window.RCIS_DATA` (mocks from `data.js` + enrichment in `data-contractors.js` / `data-schools.js`)
- Stores: `window.TodosStore`, `window.GapsStore`, `window.RenewalsStore`, `window.AssignmentsStore`, `window.ContactsStore`, `window.DocumentsStore`, `window.NotesStore`, `window.CommentsStore`, `window.GapCommentsStore`, `window.MatchProposalsStore`, `window.ScheduleSlotsStore`, `window.ContractorOverridesStore`, `window.SchoolOverridesStore`, `window.DistrictOverridesStore`, `window.SpecSettingsStore`, `window.TeamStore`
- Auth + Supabase: `window.sb`, `window.useAuth`, `window.signInWithPassword`, `window.signUpWithPassword`, `window.signOut`
- Router: `window.useRoute`, `window.navigate`, `window.Link`
- UI primitives: `window.OwnerAvatar`, `window.SpecChip`, `window.StatusPill`, `window.PrioDot`, `window.CapacityBar`, `window.WeekGrid`, `window.MiniSpark`, `window.Icon`
- Theme: `window.RCIS_BRAND`, `window.RCIS_ThemeContext`, `window.useRCISTheme`, `window.specColor(code)`, `window.specName(code)`, `window.teamMember(id)`

When adding a new shared helper, follow the same pattern (IIFE → `window.X = …`) rather than introducing imports.

### Routing

Hash-based (`router.jsx`) — no server config required, works under any static host or auth proxy. `useRoute()` returns `{ name, segs, id? }`. Routes:

```
#/                  → DashboardCalm (home)
#/board             → TasksPage
#/matchmaker        → SchedulePage  (gap ↔ contractor pairing)
#/renewals          → RenewalsPage
#/contractors[/:id] → ContractorsListPage / ContractorDetailPage
#/schools[/:id]     → SchoolsListPage / SchoolDetailPage
#/districts[/:id]   → DistrictsListPage / DistrictDetailPage
#/contacts[/:id]    → ContactsPage / ContactDetailPage
#/admin             → AdminPage (team members + specialty settings)
```

Routing dispatch lives inline in `index.html` (`App`). Use `<Link to="/board">` or `navigate('/board')` rather than `<a href>`.

### Auth + data

`<AuthGate>` (in `auth-gate.jsx`) wraps the whole app and blocks rendering until Supabase reports a session. Auth is email+password (not magic link). Sign-up auto-creates a row in `public.team_profiles` via a Postgres trigger (`handle_new_auth_user` in `supabase/schema.sql`), so the team list reflects whoever has signed in.

Supabase credentials live in `supabase-config.js` and are intentionally shipped to the browser — the publishable key is gated by **RLS policies**, not by secrecy. All policies in `supabase/schema.sql` grant `authenticated` users full read/write (`for all to authenticated using (true) with check (true)`), except for comment tables where users can only insert/delete their own rows. To change permissioning, edit the policies in `schema.sql` and re-paste into Supabase SQL Editor — the file is idempotent (uses `if not exists` / `drop policy if exists`).

### Store pattern (important — every store works this way)

Each store is a singleton IIFE with the same shape, e.g. `todos-store.js`:

1. **Cold-start cache** — reads `localStorage` (e.g. `rcis.todos.cache.v2`) so the UI renders instantly.
2. **Load** — `await sb.from(TABLE).select(...)` after auth resolves, calls `setState(rows.map(fromRow))`.
3. **Realtime subscription** — `sb.channel(...).on('postgres_changes', ...)` syncs teammate edits.
4. **Mutations** — optimistic local update first, then `sb.from(TABLE).insert|update|delete`. On error, the store logs but does **not** roll back state; the next realtime tick will reconcile.
5. **Auth gating** — `auth.onAuthStateChange` triggers load/subscribe on sign-in and clears state on sign-out.
6. **`fromRow` / `toRow`** — map between snake_case DB columns and camelCase in-memory shape.
7. **Public API** — `get()`, `subscribe(fn)`, plus mutation methods. A companion `useX()` hook returns the current value and re-renders on `subscribe`.

When adding a new persisted entity, copy this template from `todos-store.js` — don't re-invent it.

### Mock + override hybrid

Contractors, schools, and districts have large in-file mock catalogs (`data.js`, `data-contractors.js`, `data-schools.js`) that are merged with two kinds of Supabase data on read:

- **Per-entity overrides** (`contractor_overrides`, `school_overrides`, `district_overrides`) — patch the mock record's editable fields (pay/bill rate, name, address, weekly schedule, etc.). Merged by `ContractorOverridesStore` / `EntityOverridesStore`.
- **User-created rows** in `assignments`, `coverage_gaps`, `renewals`, `match_proposals`, `schedule_slots`, `contacts`, `documents`, `entity_notes` — live alongside mock seeds.

Treat the mocks as the **prototype dataset**. When real RCIS data arrives, it plugs in at the same shape (or replaces the mocks entirely by deleting `data-*.js` and writing to Supabase directly).

### Money math

`financials.js` is the single source of truth for any pay/bill/margin number. Conventions:

- `WEEKS_PER_MONTH = 4`, `WEEKS_PER_SCHOOL_YEAR = 36`
- Effective rate = assignment-level rate if set, else contractor default
- `weeklyHours(a) = direct + indirect`
- **Gross margin** = `bill − pay`. **Net margin** = `bill − pay − burden(spec)`. Burden comes from `window.burdenFor(specCode)` via `SpecSettingsStore`; defaults to 0 when no spec or no admin-set row.
- The `marginPerHour` / `weeklyMargin` / `annualMargin` helpers are gross. The matching `netMarginPerHour` / `weeklyNetMargin` / `annualNetMargin` helpers subtract burden per row.

Don't multiply rates × hours inline in components — call into `ContractorFinancials` so future tweaks (utilization targets, real payroll integration) land in one place.

### Theming + the Tweaks panel

`shared.jsx` defines the brand tokens. `shell-calm.jsx` exposes `calmPalette(dark)` — the palette object passed as `pal` to most components. Dark mode is persisted to `localStorage` under `rcis.theme`.

The bottom-right "Tweaks" panel (`tweaks-panel.jsx`) is **two things**:

1. A live config panel for dev-time toggles (visible widgets, theme).
2. A host protocol — the file listens for `__activate_edit_mode` / `__deactivate_edit_mode` and posts `__edit_mode_available` / `__edit_mode_set_keys`. The `/*EDITMODE-BEGIN*/{...}/*EDITMODE-END*/` block in `index.html` is rewritten on disk by an external dev host (a design tool) using those messages. Don't remove or rename the markers.

### Matchmaker page specifics

`page-schedule.jsx` ranks contractors against coverage gaps. Rules to keep in mind when editing:

- `gap.modality` is `'onsite' | 'tele' | 'either'`. Onsite gaps enforce a 100-mile radius (`ONSITE_RADIUS_MILES`).
- Default bill rate fallback is `$85/hr` when neither the gap nor the override sets one.
- "Confirm" on a shortlist proposal creates an `assignments` row and flips `coverage_gaps.status` to `filled`. Dismissed and confirmed proposals are kept as history. A partial unique index on `match_proposals` enforces only one **pending** proposal per `(gap_id, contractor_id)` pair — confirmed/dismissed rows are unconstrained.

### Specialties

Hardcoded across the app: `SLP`, `OT`, `PT`, `PSY`, `BCBA`, `MH`, `SPED`. Colors and full names come from `RCIS_DATA.SPECIALTIES` via `specColor(code)` / `specName(code)`. Don't introduce a new specialty code without adding it there.

### "Today"

The mocks are frozen as if it were Friday, May 16, 2025 (`window.RCIS_TODAY`). Several widgets compute relative days from that date rather than `Date.now()` — when adding date math, decide which behavior you want before using one or the other.

## Database

Schema is a single file: `supabase/schema.sql`. To apply: paste into Supabase SQL Editor and run. Safe to re-run (idempotent).

Key tables and their purpose:

- `todos` + `task_comments` — Kanban board (`column_name` in `todo|doing|attention|done`).
- `coverage_gaps` + `gap_comments` — open positions/coverage needs. Scope is `school` or `district`.
- `renewals` — licenses / insurance / contracts with `expires_on`. Kinds: `contractor_license`, `contractor_insurance`, `contractor_background`, `client_contract`.
- `assignments` — contractor → school/district placements with `schedule` (4×5 boolean grid: block × weekday).
- `match_proposals` — Matchmaker shortlist (see above).
- `schedule_slots` — row-per-time-block schedules, supports CSV/XLS import via `source='import'` + `import_batch_id`.
- `team_profiles` — public-safe mirror of `auth.users`, auto-populated by trigger.
- `documents` — link docs (`source='link'`, `url` set) or uploaded docs (`source='upload'`, `storage_path` set). Uploads stream from the **`task-attachments` Storage bucket** (same bucket for tasks and renewals) via signed URLs.
- `entity_notes` — free-text notes per (scope, scope_id).
- `contractor_overrides`, `school_overrides`, `district_overrides` — see "Mock + override hybrid" above.
- `spec_settings` — per-specialty admin-editable config: `indirect_ratio` (drives the AssignmentEditor auto-indirect), `burden_per_billable_hour` (drives net margin), and default pay/bill rate bands. Edited from `/admin`.

Every table gets a `touch_updated_at` trigger and is added to the `supabase_realtime` publication. When you add a table, follow the same three-step pattern in `schema.sql`: create → trigger → realtime → RLS policy.
