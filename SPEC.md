# RCIS Internal Dashboard — Plan

The forward-looking plan for the RCIS Internal Dashboard. This file lists only
what is **not done yet**. It is not a status archive — git history is the record
of what shipped. When an item is finished it is deleted from this file in the
same commit that ships it; when new work is found, it is added here.

**Guiding priority:** get a mostly working prototype in front of the team
before investing in integrations or deep polish.

**Where we are (Oct 17, 2026):** the prototype is live at
`https://rcis-dash.vercel.app` on the free Supabase tier and the team is
using it. Sign-up is invite-only (add the teammate on /admin, they create
their account with that email) and sign-in is complete: email + password,
"Forgot password?" recovery, "Change password" on /admin, and "Continue
with Google" for Rock Creek Workspace accounts. Access control is enforced
in RLS: an inactive teammate is refused every read and write, and only
admins (`team_profiles.is_admin`) can invite or edit other profiles.
`supabase/rollback-rls-active-admin.sql` undoes those policies in one
paste if ever needed.

Shipped since Oct 8: the Assignments master page (`/assignments`, PR #3,
Oct 13) and finance visibility (PRs #4 and #5, Oct 17). Since Oct 17 every
pay, bill, burden, revenue and margin figure lives in five admin-only
tables (`contractor_pay_rates`, `assignment_rates`, `gap_bill_rates`,
`spec_financials`, `district_rate_cards`), is read and written only by
`finance-rates-store.js`, and renders only for admins through
`useFinanceAccess()`. The shared tables have no money column any more.
Admins: Christo, Kathleen, Mark. Everyone else sees no financial widget,
and `/financials` tells them it is admin-only. The rollout is complete,
including the final column drop; `docs/finance-visibility-scope.md` is the
record and holds the rollback procedure (`supabase/rollback-finance-access.sql`
works out its mode from the database).

**Handoff notes (Oct 17, 2026), for whoever picks this up next:**

- Treat money as admin-only by construction. A new pay or bill field goes
  in a finance table with an `is_admin()` policy and is read through
  `FinanceRatesStore`, never added to a shared table. CLAUDE.md "Auth +
  data" and "Money math" say how.
- Verifying anything financial needs two sign-ins: an admin and a
  non-admin (a pending-invite test account works). Email + password
  sign-in works on any localhost port; in a worktree use a port other
  than 4173.
- The table comment on `spec_financials` reads `LOCKED …` and is the
  rollout state marker. Leave it alone; the one-shot SQL files read it.
- Pushes and merges are the owner's: Claude sessions are not permitted to
  run `git push` or `gh pr merge` here, so expect to be handed the command.
- Two small follow-ups from the Phase B code review sit under Polish.

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
4. Sign in with email + password on localhost (any port works for this;
   use a free port such as 4175 when running from a worktree). Anything
   financial needs a second, non-admin sign-in to confirm it is hidden.
   Google and recovery-link
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

The page exists at `/financials` (admins only since Oct 17) with the margin
calculator and the Specialty settings section, which now writes the ratio
to `spec_settings` and burden to `spec_financials`. Remaining: the
**reporting rollup** — company-wide earned revenue, gross/net margin, and
projections, broken down by company total / district / specialty /
contractor. Depends on a monthly time-entries CSV import from the time
tracker; build after that import exists. Fully scoped in
`docs/financials-page-scope.md`.

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
- **Finance visibility follow-ups (Phase B review, Oct 17, 2026).** (a)
  Clearing a mock contractor's pay deletes its `contractor_pay_rates` row
  and the prototype rate from `data-contractors.js` reappears; goes away
  with the real data migration. (b) The three-line admin gate is pasted
  into about fifteen components; fold it into one boolean hook when next
  touching those files.
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
  to anyone with the URL. The admin-only finance tables are the only
  acceptable home for real compensation data.

---

## Open questions

- **"Today" source of truth.** `RCIS_TODAY` is frozen at a mock date while some
  date math uses the real current date. Pick one and apply it consistently.
- **Non-financial data permissions.** Finance visibility shipped Oct 17.
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
