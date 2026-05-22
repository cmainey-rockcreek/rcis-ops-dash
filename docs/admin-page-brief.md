# RCIS Admin Page — Hands-off Build Brief

You are the agent driving a multi-step build on the RCIS Ops Dashboard
with minimal interruption to the user. Work through it step by step,
review your own commits before moving on, and pause only at phase
boundaries or when you'd otherwise be guessing.

The user wants this run as automated as possible. They will not be
watching. Stop cleanly at the defined stopping point and hand back a
summary.

---

## Scope of this run

**Two phases. Stop after Phase 2 commits.** Do not start Phases 3–5.

- **Phase 1** — Admin page route + team management
- **Phase 2** — Per-spec indirect ratios + burden / Gross-Net margin
- _Phase 3 (schema cleanup), Phase 4 (sweeps), Phase 5 (code review): NOT part of this run. The user will authorize those separately later._

---

## Phase 0 — Read in (do this first, do not skip)

Before doing anything:

1. Read `CLAUDE.md` in the repo root. It documents the architecture, the
   globals-on-window module pattern, the store conventions, and the
   database structure. Follow it closely.
2. Skim `git log --oneline -10` in `/Users/christomainey/Desktop/RCIS - Internal Dashboard`
   to see what was just shipped.
3. Open `supabase/schema.sql` to understand the current data model.
4. Start the dev server in the background:
   `cd "/Users/christomainey/Desktop/RCIS - Internal Dashboard" && python3 -m http.server 4173`
   The user verifies at `http://localhost:4173/#/`.

If any of these reads reveals something that contradicts this brief,
escalate to the user before proceeding.

---

## Phase 1 — Admin page route + team management

### Build

- Add nav item "Admin" to the left sidebar (`shell-calm.jsx` — see how
  Renewals is wired).
- Add `/admin` route in `router.jsx` and dispatch in `index.html` to a
  new `AdminPage` component.
- Create `page-admin.jsx` following the same shape as `page-contacts.jsx`
  (PageShell wrapper + content function). One section for now: "Team
  members."
- Team table reads from `team_profiles` (already exists). Use the
  existing `TeamStore` if it exposes the full list; otherwise subscribe
  via `window.sb` directly.
- Columns: avatar, name, email, role, initials, color swatch, active toggle.
- Inline edits for name / role / initials / color use the same
  click-to-edit pattern as the contractor and contact headers.
  Color picker can be a small set of preset swatches.
- Active toggle flips the `active` boolean in `team_profiles`. Do NOT
  delete rows.

### Done means

- `/admin` is reachable from the sidebar
- You can rename a teammate, change initials/color, and deactivate them
- Edits persist across a hard refresh
- No console errors

### When to commit

Once everything above works on localhost. Commit message format:
`Admin page: team member management`.

### Then post a one-line status

"Phase 1 (team management) shipped — commit `<short-sha>`. Moving to Phase 2."
Do not pause for user input here unless something is stuck.

---

## Phase 2 — Per-spec indirect ratios + burden + Gross/Net margin

This is the higher-value phase. It touches every dollar number in the app.

### Schema

- New table `spec_settings`:
  - `spec_code` TEXT PRIMARY KEY
  - `indirect_ratio` NUMERIC (default 0.25)
  - `burden_per_billable_hour` NUMERIC (default 0)
  - `default_pay_low` / `default_pay_high` NUMERIC (nullable; not used in UI this round but useful to seed)
  - `default_bill_low` / `default_bill_high` NUMERIC (same)
  - `updated_at` TIMESTAMPTZ DEFAULT now()
- Seed rows from current constants in `data-contractors.js` `RATE_BANDS`
  and the `0.25` ratio from `assignments-store.js`. One row per spec
  defined in `RCIS_DATA.SPECIALTIES`.
- RLS + realtime publication, same pattern as other tables.

### Store

- New `spec-settings-store.js` mirroring `contractor-overrides-store.js`
  shape: cache, realtime, hooks.
- Export `useSpecSettings()` and synchronous helpers
  `indirectRatioFor(spec)` (default 0.25) and `burdenFor(spec)` (default 0).

### Wiring

- `AssignmentsStore.autoIndirect(direct, specCode)` takes a second arg
  and pulls the per-spec ratio. Existing one-arg callers fall back to 0.25.
- `AssignmentEditor` passes `draft.spec` to `autoIndirect` (both the
  direct-hours `onChange` path and the "Reset to auto" path).
- `financials.js`:
  - **Keep** `marginPerHour`, `weeklyMargin`, `annualMargin` as-is. These
    are now explicitly **gross**.
  - **Add** `netMarginPerHour(rows, defaults, burdenLookup)`,
    `weeklyNetMargin`, `annualNetMargin`. Subtract burden per row using
    the row's spec. If the row has no spec, burden = 0.

### UI label changes (where existing "Margin" appears, rename to
"Gross Margin" and add a "Net Margin" alongside):

- **Contractor profile header** — currently 6 KPIs. Adding Net Margin
  makes 7. If layout gets too cramped at 1280px width, **pause and ask
  the user** whether to drop "Free" (redundant with Load) or stack KPIs
  on two rows. Do not silently restructure.
- **District profile header** — add Net Margin alongside Gross Margin
- **District Revenue card** (`page-districts.jsx` RevenueCard) — show
  both annualized Gross and annualized Net, with Net margin %
- **Matchmaker shortlist card** (`page-schedule.jsx` ShortlistCard) —
  expand the per-hour row to: Bill | Pay | Burden | Gross/hr | Net/hr.
  Weekly row: Weekly rev | Weekly gross | Weekly net. Net goes red if
  negative, like the current margin behavior.
- **Matchmaker ranked contractor row** — keep the inline gross margin
  hint, add a small `(net $X.XX)` next to it.
- **Home dashboard stat tiles** — no change required (no margin tile today).

### Admin page additions

- New section "Specialty settings" with an editable table:
  spec code | indirect ratio | burden $/hr | (optionally rate bands).
- Inline edit on each numeric cell, save on blur.
- Tooltip / helper text explaining "Burden per billable hour: the
  fully-loaded cost beyond pay rate — taxes, insurance, admin overhead."

### Done means

- Editing the BCBA ratio to 0.35 immediately changes the auto-indirect
  on a new BCBA assignment
- Editing SLP burden to 12.36 immediately changes Net Margin everywhere
  it appears
- Gross Margin and Net Margin both visible on contractor profile,
  district profile + Revenue card, Matchmaker shortlist
- No console errors, no unhandled promise rejections
- A contractor with no spec or spec without burden row shows
  Net = Gross (no surprise zero or NaN)

### When to commit

Commit Phase 2 as a single coherent change when everything above works.
Suggested message:
`Admin: per-spec indirect ratios + burden; split Gross/Net Margin app-wide`.

---

## Stop here. Handover summary

After Phase 2 commits:

1. **Do NOT start Phase 3, 4, or 5.** The user will authorize those next.
2. Post a final summary to the user with:
   - Short SHAs of the two commits
   - One-paragraph plain-English description of what they should test
     (e.g., "Open /admin, edit the SLP burden to 12.36, then open Bennett
     Ross's profile — Net Margin should drop while Gross Margin stays
     the same.")
   - Any decisions you escalated mid-run (with the answers you used)
   - Anything you noticed that's worth flagging but didn't fix (e.g.,
     suspected dead code, mock-data drift) — list, do not fix

That is the end of this run.

---

## Working rules (non-negotiable)

These come from `feedback_rcis_workflow.md` and apply to every action:

- **Static frontend, no build step.** React 18 UMD + Babel standalone.
  Do not introduce TypeScript, bundlers, tests, or CI.
- **Project root** is `/Users/christomainey/Desktop/RCIS - Internal Dashboard`.
  Never move files outside it (Vercel root depends on it).
- **Commit locally only.** Do NOT push. The user pushes via GitHub Desktop.
- **Use Co-Authored-By trailer** in commit messages:
  `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- **Test on localhost** before declaring any phase done.
- **Use existing patterns.** New stores mirror the renewals/contractors
  pattern. New editors mirror the gap-editor/renewal-editor pattern.
- **Keep RLS enabled.** Never expose Supabase service-role keys in the
  frontend.
- **Don't break legacy mock owner IDs** (`sr`, `mw`, `ep`).

## Hard do-nots for this run

- No NCES / Gusto / Google Drive integration work (separate sprint)
- No migration of contractor/school/district mock data into Supabase
- No code review pass (Phase 5 — separate run)
- No schema column drops (Phase 3 — separate run)
- No sweeps panel (Phase 4 — separate run)
- No pushing to GitHub
- No "while I'm here" refactors that aren't in this brief

## When to escalate to the user (instead of guessing)

Pause and message the user if:

- An ambiguous design decision arises that isn't covered above (e.g.,
  the contractor header layout overflow with 7 KPIs)
- Something fails twice and you're about to try a different approach
- You discover the codebase has drifted from what this brief assumes
  (e.g., the table you're about to migrate already has the column you
  planned to add)
- You hit a real bug in existing code that blocks Phase 2

Do NOT escalate for:

- Routine schema migrations within the planned scope
- Building UI from the existing patterns
- Small style/copy decisions (use your judgment matching existing files)

---

## Per-chunk discipline

Work the build in small, reviewable chunks. For each chunk, stay clear on:

- The phase you're on
- The specific deliverable for this chunk
- The files it touches
- The "done means" criteria
- Whether to commit at the end of the chunk

Review every commit's diff before moving on. If a change drifted beyond
scope, revert the extra parts before continuing.

---

## How to start

1. Confirm to the user you've read this brief and CLAUDE.md.
2. Start Phase 1.
3. Don't check in again until either: (a) Phase 1 commits cleanly, or
   (b) you hit an escalation condition.
