# RCIS Dashboard — Finance Visibility Scope

_Reference document. Produced from a planning session, Oct 16, 2026. Scope for
restricting pay, bill, revenue and margin data to admins before the dashboard
is opened to more internal staff (SPEC.md "Finance visibility"). Owner
decisions confirmed Oct 16; Phase A (schema and the one-shot SQL files)
drafted and reviewed the same day and applied to the live project Oct 17
(see SPEC.md for the receipt). Phase B (client) built, checklisted and
deployed Oct 17; `phase-b-live.sql` pasted the same day; Phase C (legacy
columns dropped) also Oct 17. The rollout is complete; this is the record
and the rollback reference._

---

## Why

Every active teammate currently has full read access to every table, so
anyone who signs in sees contractor pay rates, district bill rates, revenue
and margin on the Home page, contractor and district profiles, Matchmaker,
Assignments and the Financials page. The owner wants to invite a few more
internal people who must not see compensation or revenue, while Christo,
Kathleen and Mark keep seeing everything.

Hiding the numbers in the browser is not enough: the browser still downloads
them, and Supabase Realtime delivers whole rows to every subscriber. The
money has to be withheld by the database, and the UI then hides the empty
widgets so non-admins see a clean page rather than zeros.

## Owner decisions (confirmed Oct 16, 2026)

- **Finances are admin-only.** No new flag. Kathleen and Mark become admins
  (flipped on /admin by Christo, no SQL needed). Admin already means "can
  invite, deactivate and edit teammates"; it now also means "sees money".
  The existing `is_admin()` helper gates the finance tables.
- **Non-admins see nothing financial, not dashes.** The revenue tile,
  pay/margin KPIs, revenue columns, rate fields and the Financials page are
  removed from their view. Pages otherwise look and work the same.
- **Money moves into admin-only tables.** Four columns leave their current
  tables; one table that is already separate just gets a stricter policy.
  Details under "Data model".
- **Matchmaker ranking is unchanged.** Ranking uses free hours, status,
  priority, age and distance only (verified: `rankContractorForGap` and
  `rankGapForContractor` in `page-schedule.jsx` never read a rate). Only the
  rate, margin and "missed revenue" displays are hidden.
- **The indirect-hours ratio stays visible to everyone.** It drives the
  AssignmentEditor auto-fill and is operational, not financial. Burden and
  the default rate bands move to an admin-only table. **Editing** the ratio
  happens on the Specialty Settings card of `/financials`, which non-admins
  lose, so after Phase B only admins can change it. Confirmed by the owner
  Oct 17, 2026: admins only.
- **Attachments and notes stay team-readable.** Documents, renewal
  attachments and entity notes keep their current "any active member"
  policies. Admins must not attach rate sheets or contracts with pricing,
  or type rates into notes, until a later change gates those. Part of the
  team announcement in Phase A step 4.
- **Mock pay rates stay in `data-contractors.js` for now.** They are
  generated fake numbers. Non-admins do not see them because the UI gate
  hides every place they render, but the file itself is public. The real
  data migration must write real pay into `contractor_pay_rates`, never a
  static file. Noted in SPEC under "Real data migration".
- **Not changed:** the Kanban board, renewals, contacts, documents, notes,
  schedule slots, the active/admin model itself, the free-text `role` label,
  and the `is_active_member()` / `is_admin()` helpers.

## Done-checklist for the owner

Needs two sign-ins: Christo (admin) and a teammate **without** admin. A
pending-invite test account works for the second.

1. **As a non-admin:** Home has no "Annual revenue" tile. A contractor
   profile shows no pay rate, revenue or margin, and the contractor editor
   has no pay-rate field. The Districts list has no revenue column and a
   district profile has no rate card. Matchmaker shows no dollar figures
   anywhere. `/assignments` has no margin column and the exported CSV has no
   margin column. "Financials" is not in the sidebar and typing
   `#/financials` shows a short "not available to your account" message.
2. **As Christo:** every page looks exactly as it does today. Kathleen and
   Mark show as admins on /admin.
3. **Flip the test account to admin, then back.** After a reload it sees
   the money; flip it off, reload, and it is gone.
4. **Claude verifies, not the owner:**
   - with the non-admin account, the network requests to the five finance
     tables return zero rows and no errors, and the browser's local storage
     holds no cached rates after a normal open (not only after sign-out);
   - as an admin at localhost, with the Network tab open: create a
     contractor, edit a mock contractor's phone, edit a Supabase-created
     contractor's phone, save an assignment, save a gap, save a specialty
     row. The request bodies to `contractors`, `contractor_overrides`,
     `assignments`, `coverage_gaps` and `spec_settings` contain none of
     `pay_rate`, `bill_rate`, `burden_per_billable_hour`,
     `default_pay_low/high`, `default_bill_low/high` (the `bill_rate`
     written to `district_rate_cards` is expected). This is the Phase C
     gate: those columns are dropped later and PostgREST rejects unknown
     columns on write; the overrides store sends its whole row on every
     profile edit, so a leftover key there would break name and phone edits
     too;
   - clearing a contractor's pay rate deletes its `contractor_pay_rates`
     row rather than storing 0;
   - after each `schema.sql` paste, the policies on the five finance tables
     are exactly one "admins full access" row each (query in "Facts").

## Facts the build depends on (verified Oct 16, 2026)

- Money lives in five database places today:
  - `contractors.pay_rate` (user-created contractors) and
    `contractor_overrides.pay_rate` (patches on mock contractors). Both read
    into `contractor.rates.hourly`. The profile page writes every pay edit
    through `ContractorOverridesStore.upsert`, for Supabase-created
    contractors as well as mocks, and the merge prefers the override.
  - `assignments.pay_rate` (per-assignment override; `effectivePay` in
    `financials.js` falls back to the contractor default).
  - `coverage_gaps.bill_rate` (per-gap override; `effectiveBill` falls back
    to the district rate card, then `spec_settings.default_bill_low`).
  - `district_rate_cards` (bill rate per district × specialty). Already its
    own table with `DistrictRateCardStore`, `useDistrictRateCards()`,
    `rateCardFor()`.
  - `spec_settings`: `indirect_ratio` (operational) plus
    `burden_per_billable_hour`, `default_pay_low/high`,
    `default_bill_low/high` (financial). `SpecSettingsStore` exposes
    `indirectRatioFor()`, `burdenFor()`, `defaultBillFor()`.
- Live counts on Oct 16: 1 contractor pay, 3 override pays (no overlap), 4
  assignment pays, 1 gap bill override, 3 rate cards, 7 spec_settings rows;
  9 active teammates, 1 admin. Each of the six tables has exactly one
  policy, "team full access" on `is_active_member()`. Verification query:

  ```sql
  select tablename, policyname, cmd from pg_policies
   where schemaname = 'public'
     and tablename in ('district_rate_cards','contractor_pay_rates','assignment_rates','gap_bill_rates','spec_financials')
   order by 1;
  ```

- `useCurrentProfile()` in `team-store.js` returns `{ ready, profile,
  active, isAdmin }`. `isAdmin` is a UX hint; RLS enforces. Nothing new is
  selected from `team_profiles`, so the PostgREST unknown-column trap from
  the Oct 8 work does not apply to reads. It does apply to **writes**: a
  store that still sends a dropped column in an insert or update body gets
  HTTP 400, and the store pattern does not roll back.
- Supabase Realtime `postgres_changes` applies RLS per **row** and sends the
  full row. A column-masking view would still leak through realtime, which
  is why the money moves to separate tables. Realtime does not filter
  DELETE payloads by RLS at all; they carry only the primary key under the
  default replica identity, which is why the finance tables must keep it.
- Stores cache to `localStorage` under `rcis.<table>.cache.v1`. Each store
  writes an empty value on sign-out, so caches do clear then. The gap is
  the other direction: a non-admin who never signs out keeps pre-change
  pay, bill and burden values in those keys until the first successful load
  after Phase B, and a failed load (project paused, offline) leaves them
  in place. The Phase B client must remove the old keys on boot.
- The assignment, gap and Matchmaker editors produce `null` when a rate
  field is cleared (`page-contractors.jsx` AssignmentEditor save,
  `gap-editor.jsx`, `page-schedule.jsx` rate setter). The two contractor
  pay editors produce `0` instead (`NewContractorEditor` at
  `page-contractors.jsx:282`, `EditableRateKpi.commit` at ~729). Today both
  land in nullable legacy columns. The finance tables are NOT NULL, and 0
  would be treated as a real rate by `effectivePay`: both null and a
  blank/0 contractor pay must become a row delete.
- Financial display sites (all must be gated):
  - `dashboard-calm.jsx`: "Annual revenue" StatTile (~line 991).
  - `page-contractors.jsx`: Pay rate / Revenue / Gross Margin / Net Margin
    KPIs (~703–710); pay-rate field in the contractor editor (~355); pay
    rate in the AssignmentEditor (~1459, ~1585–1616).
  - `page-districts.jsx`: revenue sort + totals + column (~112–126, ~295);
    rate card editor on the district profile (~352+).
  - `page-schedule.jsx`: gap bill-rate setter (~299–307), weekly/missed
    revenue (~64–69, ~395, ~601–603), per-candidate margin block
    (~868–930), pay copied into a confirmed assignment (~356–366).
  - `gap-editor.jsx`: bill-rate override field (~280–291).
  - `page-assignments.jsx`: weekly margin per row (~50–64), header
    "unpriced" count (~138), CSV column (~196), margin cell (~466).
  - `page-financials.jsx`: whole page. `shell-calm.jsx` nav entry (~456).

## Data model

New tables, each with `touch_updated_at`, realtime, and RLS
`for all to authenticated using (is_admin()) with check (is_admin())`:

| Table | Key | Columns | Replaces |
|---|---|---|---|
| `contractor_pay_rates` | `contractor_id text` (no FK: mock contractors are not in `contractors`) | `pay_rate numeric not null` | `contractors.pay_rate`, `contractor_overrides.pay_rate` |
| `assignment_rates` | `assignment_id text` → `assignments` on delete cascade | `pay_rate numeric not null` | `assignments.pay_rate` |
| `gap_bill_rates` | `gap_id text` → `coverage_gaps` on delete cascade | `bill_rate numeric not null` | `coverage_gaps.bill_rate` |
| `spec_financials` | `spec_code text` | `burden_per_billable_hour`, `default_pay_low/high`, `default_bill_low/high` | the five financial columns of `spec_settings` |

Policy change only: `district_rate_cards` switches from `is_active_member()`
to `is_admin()`. `spec_settings` keeps `is_active_member()` and ends up
holding only `indirect_ratio`.

**A missing row means "no rate set".** All three rate columns are NOT NULL.
Clearing a rate deletes the row; the store must translate `rate == null`
into a delete and never send null. The FK cascades run outside RLS by
design, so a non-admin who deletes an assignment or gap removes (but never
reads) its rate row. `contractor_pay_rates` has no FK, so the contractor
delete in the client must also delete the rate row.

Because the new tables return zero rows to a non-admin instead of an error,
the stores load cleanly and `rateCardFor()`, `burdenFor()` and the pay
lookups simply find nothing. The UI gate prevents the "$0 everywhere" look
that would otherwise follow.

## The SQL files and the state marker

`schema.sql` only adds structure and sets policies. It never moves or drops
data, so re-pasting it never loses anything (it does re-apply the
admin-only rate card policy, which matters after a rollback; see there).
Until the branch merges, paste `schema.sql` only from this worktree: the
copy on `main` still creates the old "team full access" policy on
`district_rate_cards`, and permissive policies combine with OR. Five
one-shot files do the data steps, and each one checks the state of the
database before acting. The state lives in one place: the table comment on
`spec_financials`.

| Marker | Meaning |
|---|---|
| empty | the migrate has never run; finance tables hold only seeds |
| a timestamp | last run of the migrate; legacy columns are still the truth |
| `LOCKED …` | Phase B client is live; finance tables are the truth |

Nobody should edit that comment in the Supabase Table Editor (it shows as
the table "description").

- `supabase/schema.sql` — the four tables, triggers, realtime, admin-only
  policies, stricter `district_rate_cards` policy.
- `supabase/migrate-finance-rates.sql` — mirrors the legacy columns into the
  finance tables: adds, changes and clearances since the last run are all
  picked up, and each mirrored row keeps its legacy `updated_at` (touch
  triggers paused during the copy). Refuses if the marker is `LOCKED`, if
  any finance row is newer than the marker (only the Phase B client does
  that), or if the marker is empty but the rate tables already hold rows.
  Raises if any count is off, so a partial copy cannot commit. Ends with an
  expected-versus-copied receipt.
- `supabase/reset-finance-mirror.sql` — empties the four finance tables and
  clears the marker, so the next migrate rebuilds them from scratch. Only
  allowed while the legacy columns are the truth (columns present, not
  `LOCKED`). Needed because testing the Phase B client at localhost writes
  to the finance tables, which the migrate and the rollback would otherwise
  refuse over. Deploy day always starts with it.
- `supabase/phase-b-live.sql` — pasted once after the Phase B deploy is
  READY. Refuses unless the marker is the migrate's timestamp and every
  legacy rate equals its finance row (finance rows newer than the marker
  are skipped as post-mirror edits through the new client), so a skipped or
  stale final migrate cannot blank rates that were never mirrored. Then
  sets the `LOCKED` marker, blanks the legacy copies of every rate, and
  installs triggers on the five shared tables that keep those columns blank
  while `LOCKED`, so a save from a stale old-client tab cannot put a rate
  back where every active member can read it.
- `supabase/phase-c-drop-legacy-rates.sql` — drops the blanking triggers and
  the nine legacy columns. Refuses unless the marker is `LOCKED`, so it
  cannot run after a rollback has made those columns the only copy again.
- `supabase/rollback-finance-access.sql` — works out the mode from the
  database and acts accordingly (see Rollback).

## Build steps (each leaves the app loadable; check the console after each)

**Phase A — schema, applied in the Supabase SQL Editor before Phase B is
built.** There is one Supabase project, so the tables must exist before the
Phase B client can be developed and tested at localhost. The legacy columns
stay populated until deploy day.

1. Christo flips Kathleen and Mark to admin on /admin. Do this **first**:
   step 2 makes `district_rate_cards` admin-only on the live site.
2. Paste `schema.sql`. Creates the four tables and flips the rate card
   policy. Claude runs the policy query from "Facts" and confirms one
   "admins full access" row per table.
3. Paste `migrate-finance-rates.sql`. The receipt shows every `expected`
   equal to `copied`. If it errors or the counts differ, stop and ask; do
   not run the rollback as a remedy.
4. Tell the team what the window looks like. Until `phase-b-live.sql` is
   pasted on deploy day, the current client keeps running: admins see
   everything as before; the six non-admins see bill-side figures computed
   from the default band rather than the rate card (revenue tile, margins,
   Matchmaker, Assignments) and a district's rate-card editor silently
   reverts anything they type. Pay rates and the Specialty Settings card
   stay visible **and editable** to them until then, and the deploy-day
   mirror carries any such edit across. Ask non-admins not to change any
   pay, bill or burden figure in the meantime, and remind admins that
   attachments and notes are visible to everyone.

**Phase B — client, on the branch, verified at localhost after each step.**

5. `team-store.js`: add `window.useFinanceAccess()` returning
   `{ ready, canView }` where `canView = ready && isAdmin`, so pages do not
   each repeat the logic. While `ready` is false, render nothing financial
   (fail closed).
6. New `finance-rates-store.js` following the `todos-store.js` template,
   holding four maps: contractor pay, assignment pay, gap bill, and
   specialty financials (burden and bands), each loaded and **subscribed**
   via `postgres_changes`. `upsert(id, rate)` and `remove(id)` per rate
   map; `remove` is what a cleared field calls. `burdenFor()` and
   `defaultBillFor()` move here. Register it in `index.html` after
   `spec-settings-store.js` and before `financials.js`.
7. Switch the stores off the legacy columns, one at a time. In each, the
   `toRow` payload must stop **containing** the key, not send it as null:
   `assignments-store.js` (`pay_rate`), `gaps-store.js` (`bill_rate`),
   `contractors-store.js` and `contractor-overrides-store.js` (`pay_rate`),
   `spec-settings-store.js` (the five financial columns; its payload
   shrinks to `spec_code` + `indirect_ratio`). Reads of `payRate`,
   `defaultPay`, `billRate`, `contractor.rates.hourly` and the burden/bands
   come from the rates store, including inside `allAssignmentRows`. The
   editors' save paths write to the rates store: null from the assignment,
   gap and Matchmaker editors and blank/0 from the two contractor pay
   editors all call `remove`. Deleting a Supabase contractor removes its
   pay row through a trigger in `schema.sql` (there is no delete UI today;
   `ContractorsStore.remove` has no callers).
8. UI gates, one page per step in this order: Home tile → contractor profile
   and both editors → districts → Matchmaker → gap editor → assignments
   (including the CSV header and row builder) → sidebar entry and
   `/financials` route (short "not available" screen). The Specialty
   Settings card on `/financials` writes ratio to `spec_settings` and the
   rest to `spec_financials`; an error on the second write is logged and
   reloaded like every other store.
9. Remove the pre-change cache keys on boot (bump the keys of the stores
   that carried money to `.v2` and `localStorage.removeItem` the `.v1`
   keys), so stale pay, bill and burden values are gone before any network
   call. Sign-out already empties the caches.
10. Owner runs the done-checklist at localhost. `/code-review` and
    `/security-review` (touches RLS and schema). Note: this testing writes
    to the finance tables, which is why deploy day starts with the reset.

**Deploy day for Phase B, in this order.**

11. Ask **everyone**, not only admins, to make no pay, bill or burden edit
    until told: the old client is live for all until step 14, and an edit
    made after the final mirror would be blanked in step 15.
12. Paste `reset-finance-mirror.sql`, then `migrate-finance-rates.sql`
    (final mirror). The migrate receipt shows every `expected` equal to
    `copied`.
13. Merge and deploy; wait for Vercel READY.
14. Every teammate reloads the dashboard. An open tab keeps running the old
    code; after step 15 its saves are harmless (the blanking triggers null
    any rate it sends) but its own screen shows stale numbers.
15. Paste `phase-b-live.sql`. It checks the mirror is exact before doing
    anything. Receipt: every legacy count is 0 and the marker reads
    `LOCKED`. Edits can resume.

**Phase C — a few days later, once the Phase B client has proven itself.**

16. Re-check done-checklist item 4's write-body gate against the live site,
    not the branch: all six saves, all five tables.
17. Paste `phase-c-drop-legacy-rates.sql`. In the same commit, trim
    `schema.sql`: remove the five financial columns from `create table if
    not exists public.spec_settings` and its header comment, reduce its seed
    insert to `(spec_code, indirect_ratio)`, and remove the legacy
    `pay_rate` / `bill_rate` lines from the other four `create table`
    statements and their comments. Without the seed trim, the next
    `schema.sql` re-paste fails on the missing columns. Also update
    CLAUDE.md (Money math, the `spec_settings` entry under Database, the
    store list) and the code comments in `financials.js`,
    `district-rate-card-store.js` and `page-districts.jsx` that still name
    `spec_settings.default_bill_low`, so the next session is not pointed at
    dropped columns.

## Rollback

`supabase/rollback-finance-access.sql`, paste-and-run. **Run it first, then
deploy the pre-change commit**; ask the admins not to change any rate in
between. The file reads the marker and the columns and picks a mode:

- **A — Phase A only** (legacy columns present, no `LOCKED`): the live
  client has been writing the legacy columns all along, so they are already
  current. Nothing is copied back; the finance tables are dropped.
- **B — Phase B live** (`LOCKED`): the finance tables are the truth. The
  legacy columns are blanked and rebuilt to mirror them exactly, including
  rates removed through the app.
- **C — Phase C has run** (legacy columns gone): re-adds them, then as B.

If finance rows are newer than the migrate marker but `phase-b-live.sql`
was never pasted, or the marker is empty while the rate tables hold rows,
the file refuses rather than guess; its hint asks whether the new dashboard
is live on Vercel and points to the reset file if not. Re-running the
rollback is a no-op. The rollback also removes the blanking triggers and
the contractor-delete cascade trigger.

After a rollback, do **not** re-paste `schema.sql` for unrelated reasons
until going forward again: it recreates the empty finance tables and makes
`district_rate_cards` admin-only again under the old client. Going forward
again: paste `schema.sql`, paste the migrate, deploy the Phase B client,
paste `phase-b-live.sql`.

## Things that bite

- **Schema before code, and the Phase C gate.** Phase A must be applied
  before Phase B is developed (one Supabase project). Phase C must not run
  until the live client sends none of the legacy keys in write bodies.
  Reads of a dropped column are harmless after the drop; writes are not.
- **The migrate is for the legacy-truth window only.** Its guard enforces
  that. If it ever refuses, the message says why and what to do; stop and
  ask rather than reach for the rollback. Testing the Phase B client at
  localhost is the expected reason for a refusal, and the reset file is the
  answer.
- **Between deploy READY and `phase-b-live.sql`** a rate cleared through
  the new client (row deleted) leaves no trace the guards can see; a
  migrate run in that window would re-insert it from the legacy column.
  Step 11's edit freeze covers this; the window is minutes.
- **Realtime.** The four tables are in `supabase_realtime`; the finance
  store subscribes to all four. Realtime respects RLS for inserts and
  updates, so a non-admin browser receives no rate rows. DELETE payloads
  are not filtered but carry only the key; never set `replica identity
  full` on these tables.
- **Fail closed while loading.** `useCurrentProfile().ready` is false for a
  moment on cold start; financial widgets must not flash before the flag
  is known. Cached finance stores are empty for non-admins anyway, but the
  mock pay rates are not, so the gate is on `ready && isAdmin`.
- **Mock contractors' pay.** Comes from `data-contractors.js`, not the
  database. The UI gate is the only thing hiding it for now; it is fake.
  The real data migration must not carry this pattern forward.
- **Confirming a Matchmaker proposal as a non-admin.** Today the confirm
  copies the contractor's pay into the assignment. With no access there is
  no copy, the new assignment has no rate row, and admins see the
  contractor default via `effectivePay`. Acceptable; note in the code.
- **Creating a gap as a non-admin.** No bill-rate override is possible; the
  gap uses the district rate card. Acceptable.
- **Assignment and contractor deletion.** `assignment_rates` and
  `gap_bill_rates` cascade on delete, but the store's optimistic local
  removal must also drop the local rate entry or the margin column briefly
  shows a stale value for admins. `contractor_pay_rates` does not cascade;
  the client deletes it alongside the contractor.
- **CSV.** The margin column is built in two places in
  `page-assignments.jsx` (header and row). Gate both or the file is
  misaligned.
- **The Specialty Settings card** on `/financials` writes two tables after
  the split. Log and reload on error like every other store.
