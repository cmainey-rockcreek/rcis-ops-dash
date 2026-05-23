# RCIS Internal Dashboard — Plan

The forward-looking plan for the RCIS Internal Dashboard. This file lists only
what is **not done yet**. It is not a status archive — git history is the record
of what shipped. When an item is finished it is deleted from this file in the
same commit that ships it; when new work is found, it is added here.

**Guiding priority:** get a mostly working prototype in front of the team
before investing in integrations or deep polish.

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

### Prototype work — do first

- **Invite users from the Admin page (lightweight).** Pre-add a teammate
  (name, email, role) as a pending profile; they self-sign-up with that email
  and get linked to the profile. No backend, no system-sent email. The full
  invite flow and closed signup are parked (see Parking lot).
- **Multi-user + onboarding test pass.** With a second account, verify the
  sign-up trigger and team list, realtime sync across users, per-user comment
  permissions, the new user's avatar/initials/color, and the first-run
  experience. Likely to surface its own follow-up items.

### Financials page

The page exists at `/financials` with the margin calculator and the
Specialty settings section (lifted from /admin). Remaining: the
**reporting rollup** — company-wide earned revenue, gross/net margin, and
projections, broken down by company total / district / specialty /
contractor. Depends on a monthly time-entries CSV import from the time
tracker; build after that import exists. Fully scoped in
`docs/financials-page-scope.md`.

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
- **Roles.** Roles are currently labels only. Decide whether they should ever
  control permissions (see Parking lot).

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
- **Full user-invite flow + closed signup** — a real invite email and
  invite-only access. Needs a Supabase Edge Function to hold the service-role
  key; deferred past the prototype.
- **Role-based permissions enforcement.**
