# RCIS Internal Dashboard — Plan

The forward-looking plan for the RCIS Internal Dashboard. This file lists only
what is **not done yet**. It is not a status archive — git history is the record
of what shipped. When an item is finished it is deleted from this file in the
same commit that ships it; when new work is found, it is added here.

**Guiding priority:** get a mostly working prototype in front of the team
before investing in integrations or deep polish.

**Where we are (Oct 13, 2026):** the prototype is live at
`https://rcis-dash.vercel.app` on the free Supabase tier and the team is
using it. Sign-up is invite-only (add the teammate on /admin, they create
their account with that email) and sign-in is complete: email + password,
"Forgot password?" recovery, "Change password" on /admin, and "Continue
with Google" for Rock Creek Workspace accounts. Access control is enforced
in RLS: an inactive teammate is refused every read and write, and only
admins (`team_profiles.is_admin`) can invite or edit other profiles.
Christo is the admin. `supabase/rollback-rls-active-admin.sql` undoes the
policies in one paste if ever needed.

The Assignments master page shipped Oct 13 (PR #3, live). `/assignments`
lists every placement grouped by school under district, with a flat
sortable table toggle, filters, totals, a show-completed chip, the same
editor as the contractor page, and the app's first working CSV export.
Owner ran the four-item done-checklist at localhost; code review at high
effort found six items, four fixed, two deferred to Polish below. Not yet
exercised: attachment upload and delete from that page, the CSV opening in
Excel, and a saved row whose contractor was later deleted (listed under
Polish).

**Next:** the Content-Security-Policy + production React item below is the
last piece of the security gate. Decide in planning whether to keep Babel
compiling in the browser (a looser CSP) or add a small pre-compile step (a
strict one). After it comes the real data migration, then the items that
depend on real data.

## What we are building

An internal shared workspace and lightweight CRM for the RCIS operations team:
Christo (Director of Recruitment & Partnerships), Kathleen (Founder), Mark
(Accounting & Operations), and a future People Manager. The goal is one place
where the whole team can see what is happening and track work together. It
tracks roughly 30 to 50 active contractors and 250+ client schools. Internal
use only. No contractors or district contacts log in.

## How to verify work

There is no automated test suite. After each item, verify by hand:

1. Start the dev server: `python3 -m http.server 4173` from the repo root.
2. Open `http://localhost:4173` in a browser.
3. Confirm the page loads with no errors in the browser console, and the change
   works as described.
4. Sign in with email + password on localhost. Google and recovery-link
   sign-ins return through Supabase and only come back to localhost because
   `http://localhost:4173/**` is in Auth → URL Configuration → Redirect URLs
   (added Oct 8). If a redirect ever lands on the live site, you are testing
   production code, not the change. Check the address bar before trusting a
   result.

Commit each completed item with a short, clear message, and delete the item
from this file in that same commit.

---

## What's left

### Financials page

The page exists at `/financials` with the margin calculator and the
Specialty settings section (lifted from /admin). Remaining: the
**reporting rollup** — company-wide earned revenue, gross/net margin, and
projections, broken down by company total / district / specialty /
contractor. Depends on a monthly time-entries CSV import from the time
tracker; build after that import exists. Fully scoped in
`docs/financials-page-scope.md`.

### Finance visibility — Phase A drafted Oct 16, 2026

Before more internal staff are invited, pay, bill, revenue and margin must
be visible only to admins. Decided Oct 16: no new flag; Kathleen and Mark
become admins. The money moves out of the shared tables into admin-only
tables (`contractor_pay_rates`, `assignment_rates`, `gap_bill_rates`,
`spec_financials`) so RLS and Realtime withhold it, and the UI hides every
financial widget for everyone else. Fully scoped in
`docs/finance-visibility-scope.md`.

- **Phase A — schema. Applied to the live project Oct 17, 2026** (schema
  via a Supabase migration named `finance_visibility_phase_a_schema`, then
  the migrate; receipt 4/4/1/7, value-level mirror exact, impersonation
  check: non-admin sees 0 rows in all five finance tables, admin sees all).
  Two admins at apply time; flip the remaining one on /admin if not done.
  `schema.sql` adds the tables,
  triggers, realtime and admin-only policies and never moves or drops
  data. Five guarded one-shot files do the data steps:
  `migrate-finance-rates.sql`, `reset-finance-mirror.sql`,
  `phase-b-live.sql`, `phase-c-drop-legacy-rates.sql`,
  `rollback-finance-access.sql`. State lives in the table comment on
  `spec_financials` (empty / timestamp / `LOCKED`). Owner steps, in order:
  flip Kathleen and Mark to admin on /admin, paste `schema.sql` (from this
  worktree, not `main`), paste the migrate and check its receipt, tell the
  team that until deploy day non-admins see default-band bill figures,
  cannot edit rate cards, and should not change any pay, bill or burden
  figure. Decided Oct 17: after Phase B only admins can edit the
  indirect-hours ratio (it lives on `/financials`); everyone still sees
  the auto-fill it drives.
- **Phase B — client.** New `finance-rates-store.js` (four maps, realtime,
  `remove` for a cleared or 0 rate), stores stop reading **and sending**
  the legacy keys, `useFinanceAccess()` gate, every financial widget hidden
  for non-admins, `/financials` route and sidebar entry gated, pre-change
  cache keys removed on boot. Localhost testing writes to the finance
  tables, so deploy day order is: everyone stops editing rates → paste the
  reset → paste the migrate → deploy → everyone reloads → paste
  `phase-b-live.sql` (checks the mirror is exact, locks, blanks the legacy
  copies, installs blanking triggers).
- **Phase C — drop the legacy columns** a few days after Phase B is live:
  paste `phase-c-drop-legacy-rates.sql` (refuses unless `LOCKED`). Same
  commit: trim the `spec_settings` create table and seed insert in
  `schema.sql`, remove the legacy `pay_rate` / `bill_rate` lines from the
  other four create tables, and update CLAUDE.md and the code comments that
  still name `spec_settings.default_bill_low`. Precondition: the live
  client sends none of the legacy keys in write bodies to any of the five
  tables (done-checklist item 4 in the brief).

### Next up — security gate, before real data migration

Found in the Oct 2026 security pass. Invite-only sign-up, the profile
identity guard, link-scheme checks, SRI, the schema hardening, the sign-in
work (recovery, change-password, Google), and active/admin enforcement in
RLS have shipped. This is the remaining larger item that should land before
real therapist / school data replaces the mocks.

- **Content-Security-Policy + production React.** No CSP headers in
  `vercel.json`; `index.html` loads React/ReactDOM development builds and
  compiles JSX in the browser. Add a CSP (script-src self + the four CDN
  hosts, connect-src the Supabase project; Google sign-in is a full-page
  redirect so it needs no extra origin) and switch to production builds.
  Verify Google sign-in and the recovery link still land correctly after
  the CSP is on, since both return via a URL fragment.

### After the real data migration

- **Data export to CSV** — contractors, schools, districts, and contacts, from
  the Admin page. `window.downloadCSV` (shared.jsx) exists now; the three
  placeholder "Export CSV" buttons on the list pages still have no handler.
- **Read-only Supabase report access** — connect a read-only Supabase
  connector so reports can be pulled from live data (ad hoc, a live report
  page, or scheduled).
- **Auto-update weekly capacity** — pull capacity from the monthly capacity
  spreadsheets therapists fill out, instead of a static field. Needs a sync
  from those Google Sheets.

### Polish

- **Assignments page — untested paths and watch-outs (shipped Oct 13,
  2026).** Not yet exercised: uploading an attachment from `/assignments`,
  deleting a saved assignment from `/assignments`, the exported CSV opening
  in Excel, and a saved assignment whose contractor was later deleted (the
  row still lists under the stored name with $0 default pay, so its margin
  equals the full bill). Could break: the sidebar badge goes blank if any
  of the seven stores it subscribes to fails to load (the shell still
  renders); a district with no rate card and no specialty default bill
  shows "—" per row and "N without a bill rate" in the header; the CSV
  button is a browser download, which some browsers prompt for on first
  use.
- **PT specialty color is nearly invisible in dark mode.** `SpecChip` and
  the initials avatar on `/assignments` use `specColor('PT')`, a navy close
  to the dark card background. Pick a dark-safe color in
  `RCIS_DATA.SPECIALTIES` or add a dark-mode variant in `specColor`.
- **Dashboard revenue tile merges assignments inline.** `dashboard-calm.jsx`
  builds its own mock + persisted assignment merge. Switch it to
  `window.allAssignmentRows` so the home tile and `/assignments` cannot
  disagree.
- **Page-by-page polish pass.** Review each page for rough edges, broken
  states, and visual inconsistency. Log anything larger as a new item here.
- **`schema.sql` is not fresh-database safe.** The invite / cancel-invite
  policies reference `team_profiles.invited`, but that column is only added
  by the pending-invite migration at the bottom of the file. Fine on the
  live project (column exists); a brand-new Supabase project would fail
  partway. Fix: add `invited` with `add column if not exists` right after
  the `create table` near the top, leaving the migration block as a no-op.
- **Identity-provider name overwrites the admin-typed name.** On every
  sign-in `TeamStore.ensureCurrentProfile` replaces `full_name` with the
  name from the auth metadata (sign-up form, or Google's profile name). An
  admin edit on /admin is undone at the teammate's next sign-in. Decide
  which should win and only fill from metadata when the profile name is
  blank.

---

## Real data migration

The pivot from prototype to real tool: replacing the mock catalogs with real
RCIS data (~50 therapists, 250+ schools). Fully specified in
`docs/data-migration-plan.md` — source-of-truth map, anti-corruption rules, and
the migration sequence. Not yet scheduled; will get its own brief.

- **Real pay rates go into `contractor_pay_rates`, never a static file.**
  Mock pay today is generated in `data-contractors.js`, which Vercel serves
  to anyone with the URL. Once finance visibility ships, the finance-only
  tables are the only acceptable home for real compensation data.

---

## Open questions

- **"Today" source of truth.** `RCIS_TODAY` is frozen at a mock date while some
  date math uses the real current date. Pick one and apply it consistently.
- **Non-financial data permissions.** Finance visibility is scoped above.
  Every active teammate still has full read/write on contractors, schools,
  districts, tasks, gaps, renewals and attachments. Decide later whether
  any of that should be limited too. The free-text `role` stays a display
  label either way.

## Future direction — not urgent

- Consolidate systems over time, with a Gusto integration to push contractor
  data into the dashboard live instead of manual snapshots.

## Parking lot — not now

- **Admin app settings** — a home for the theme default and dashboard widget
  defaults (`TWEAK_DEFAULTS`). Reviewed and deprioritized: per-user, rarely
  changed.
- **Editable reference lists** — specialties, task categories, renewal types.
  Deprioritized: low-frequency, and editable specialties carry data-integrity
  risk.
- **Editable financial assumptions** — `WEEKS_PER_MONTH`,
  `WEEKS_PER_SCHOOL_YEAR`. Low value; revisit only if needed.
- **System-sent invite email.** Invite-only access shipped (Oct 2026) via the
  sign-up trigger; what's left is the dashboard emailing the invitee instead
  of the admin sharing the URL out of band. Needs a Supabase Edge Function to
  hold the service-role key; deferred past the prototype.
