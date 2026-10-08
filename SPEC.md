# RCIS Internal Dashboard — Plan

The forward-looking plan for the RCIS Internal Dashboard. This file lists only
what is **not done yet**. It is not a status archive — git history is the record
of what shipped. When an item is finished it is deleted from this file in the
same commit that ships it; when new work is found, it is added here.

**Guiding priority:** get a mostly working prototype in front of the team
before investing in integrations or deep polish.

**Where we are (Oct 8, 2026):** the prototype is live at
`https://rcis-dash.vercel.app` on the free Supabase tier and the team can
start using it. Sign-up is invite-only (add the teammate on /admin, they
create their account with that email). Sign-in shipped in full on Oct 8:
email+password, "Forgot password?" recovery with a set-password screen,
"Change password" on /admin, and "Continue with Google" for Rock Creek
Workspace accounts (Google provider enabled in Supabase; redirect URLs for
the live site, localhost, and Vercel previews are in the allowlist). All
three were verified on localhost and the Google path on the Vercel preview.
Gotcha: if a redirect sign-in (Google, recovery link) started on localhost
lands on the live site instead, `http://localhost:4173/**` is missing from
Supabase Auth → URL Configuration → Redirect URLs. It was added Oct 8; the
tell-tale is testing "on localhost" while actually running production code.
Access control shipped Oct 8: a deactivated teammate is locked out by RLS,
and only admins (`team_profiles.is_admin`, set from /admin) can invite,
deactivate, or promote. Next is the CSP item below; then the real data
migration, then the items that depend on real data.

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
  the Admin page.
- **Read-only Supabase report access** — connect a read-only Supabase
  connector so reports can be pulled from live data (ad hoc, a live report
  page, or scheduled).
- **Auto-update weekly capacity** — pull capacity from the monthly capacity
  spreadsheets therapists fill out, instead of a static field. Needs a sync
  from those Google Sheets.

### Polish

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

---

## Open questions

- **"Today" source of truth.** `RCIS_TODAY` is frozen at a mock date while some
  date math uses the real current date. Pick one and apply it consistently.
- **Data-level permissions.** The admin flag gates team management only.
  Every active teammate still has full read/write on contractors, schools,
  districts, tasks, gaps, renewals, financial settings, and attachments.
  Decide whether non-admins should ever be limited (pay / bill rates, the
  Financials page, specialty settings are the likely candidates). That
  would be a second RLS pass plus matching UI gating. The free-text `role`
  stays a display label either way.

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
