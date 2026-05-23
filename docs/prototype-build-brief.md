# RCIS Prototype Build — Claude Code Brief

You are building the next set of prototype features for the RCIS Internal
Dashboard.

**Run this in plan mode.** Produce a plan, present it for approval, and do not
edit any files until the user approves. Then execute one phase at a time.

## Scope of this run

Four phases — the items from `SPEC.md` that can be built now, without the data
migration. Work them in order.

1. **Phase 1** — Fix stale capacity / free-hours
2. **Phase 2** — Bill rate model (district rate card)
3. **Phase 3** — Financials page: scaffold + margin calculator + move Specialty settings
4. **Phase 4** — Lightweight user invite from the Admin page

**After every phase: code review, commit, then pause for the user to verify in
the browser and approve before the next phase begins.** Do not run phases
together.

Not in this run: the reporting rollup, data export, read-only report access,
and capacity auto-update — all depend on the data migration, which is a
separate project (`docs/data-migration-plan.md`).

## Phase 0 — Read in (do this first)

1. Read `CLAUDE.md` — architecture, the globals-on-window pattern, the store
   pattern, the database conventions. Follow it closely.
2. Read `SPEC.md` — the four phases below are its "What's left" items.
3. Read `docs/financials-page-scope.md` — the full scope for Phase 3.
4. Read the "bill rate model" section of `docs/data-migration-plan.md` —
   context for Phase 2.
5. Run `git log --oneline -10` to see what shipped recently.
6. Start the dev server: `python3 -m http.server 4173` from the repo root.

If anything you read contradicts this brief, stop and ask the user.

## Phase 1 — Fix stale capacity / free-hours

**Problem.** Matchmaker (`page-schedule.jsx`, `freeHours`) and the contractors
list page compute booked hours from the static `c.assigned` field. That field
is zero for any contractor created in the app and never updates when
assignments change — so an over-capacity contractor can show as fully free.

**Build.** Compute booked hours live from the contractor's active assignments
(via `AssignmentsStore`) everywhere it is currently read from `c.assigned`. The
contractor detail page (`page-contractors.jsx`) already does this correctly —
reuse that computation as one shared helper rather than duplicating it.

**Done means.** A contractor created in the app whose assignments exceed
capacity shows correct (zero / over) free hours in Matchmaker and correct load
on the contractors list, matching the detail page. No console errors.

## Phase 2 — Bill rate model (district rate card)

This is the heaviest phase — it touches every margin number. Plan it carefully.

**Build.** Bill rate is set per (district × specialty), not per contractor.

- Add a **district rate card**: per district, a bill rate for each specialty.
  Add storage following the schema patterns in `supabase/schema.sql` (create /
  trigger / realtime / RLS) and a store following the existing store pattern.
- The rate card is editable on the district profile.
- Each assignment **derives** its bill rate from its district plus the
  contractor's specialty — looked up, not stored on the assignment.
- Update `financials.js` so the effective bill rate comes from the rate card.
- **Remove** the contractor-level bill rate — the field and any UI for it.

**Done means.** Changing a district's SLP rate immediately flows to every SLP
assignment in that district. All gross/net margin displays — Matchmaker,
contractor and district profiles — still compute, with no NaN and no blanks.
No contractor-level bill rate remains. No console errors.

## Phase 3 — Financials page

Follow `docs/financials-page-scope.md`. **Build only Parts 2 and 3** — the
margin calculator and the Specialty settings move. The reporting rollup (Part 1)
is NOT in this run.

**Build.**

- Scaffold a new page at `#/financials` — route, sidebar nav entry, page
  component — following the Admin page pattern.
- **Margin calculator** — a live what-if tool. Inputs: bill rate, pay rate,
  specialty, hours/week. Outputs: gross and net margin per hour, margin %,
  weekly, annualized. Reuse `financials.js` and per-spec burden. Nothing saved.
- **Move Specialty settings** — move the existing Specialty settings section
  from the Admin page to the Financials page, and remove it from Admin.

**Done means.** `/financials` is reachable from the sidebar. The calculator
computes correctly. Specialty settings works on the new page and is gone from
Admin. No console errors.

## Phase 4 — Lightweight user invite

**Build.** On the Admin page, let an existing user pre-add a teammate (name,
email, role), creating a **pending** `team_profiles` row. When that person
self-signs-up with that email, they link to the pending profile instead of
creating a duplicate. No backend, no system-sent email, no Edge Function.

Take care not to break the existing `handle_new_auth_user` signup trigger.

**Done means.** You can pre-add a pending teammate on the Admin page; they show
as pending; signing up with that email links to the pending profile with no
duplicate row. No console errors.

## Code review — required after every phase

Before committing each phase:

1. **Confirm it runs.** The dev server still serves the app with no load-time
   failure. (Full browser-console verification happens at the pause — step 6.)
2. **Code-review subagent.** Spawn a fresh subagent to review the working-tree
   diff against this phase's "Done means" — checking for scope drift, broken
   existing behavior, deviations from the `CLAUDE.md` patterns (store pattern,
   globals-on-window, `index.html` script load order), and obvious bugs. Fix
   every valid finding.
3. **Security review.** For Phase 2 and Phase 4, also run `/security-review` —
   they touch RLS-governed data and auth. Address the findings.
4. **Diff check.** Review your own diff and revert anything outside this
   phase's scope. Do not fix unrelated issues — list them for the user instead.
5. **Commit** (local only) and **update `SPEC.md`** — delete the shipped item
   in the same commit.
6. **Post a one-line status and PAUSE.** Do not start the next phase until the
   user has verified in the browser (feature works, console clean) and
   approved.

## Working rules

- Static frontend, no build step. Do not add TypeScript, bundlers, tests, or CI.
- Commit locally only — do NOT push. The user pushes via GitHub Desktop.
- Commit-message trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- Use existing patterns — new stores mirror the existing stores, new editors
  mirror the existing editors.
- Keep RLS enabled. Never put the Supabase service-role key in the frontend.
- Don't break the legacy mock owner IDs (`sr`, `mw`, `ep`).

## Hard do-nots

- No reporting rollup, data export, report access, or capacity auto-update —
  not this run.
- No data migration work.
- No Edge Functions or full invite flow — Phase 4 is the lightweight version.
- No pushing to GitHub.
- No "while I'm here" refactors outside the phase scope.
- Do not start a phase before the user approves the previous one.

## When to escalate

Pause and ask the user if: the codebase has drifted from what this brief
assumes, something fails twice and you are about to try a different approach,
or an ambiguous decision arises that this brief and `CLAUDE.md` do not cover.
