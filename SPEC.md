# RCIS Internal Dashboard — Plan

The forward-looking plan for the RCIS Internal Dashboard. This file lists only
what is **not done yet**. It is not a status archive — git history is the record
of what shipped. When an item is finished it is deleted from this file in the
same commit that ships it; when new work is found, it is added here.

**Guiding priority:** get a mostly working prototype in front of the team
before investing in integrations or deep polish.

**Where we are (Oct 7, 2026):** the prototype is live at
`https://rcis-dash.vercel.app` on the free Supabase tier, sign-up is
invite-only (add the teammate on /admin, they create their account with that
email), and the multi-user onboarding pass is done with a second account.
The team can start using it. The sequence from here is: password recovery
(next), the rest of the security gate, then the real data migration, then
the items that depend on real data.

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

### Next up — password recovery / change-password

Nobody can reset a forgotten password today, and a `type=recovery` link just
signs the user in without asking for a new one (`detectSessionInUrl` + the
hash router in `router.jsx` swallow the `#access_token=…&type=recovery`
fragment). First thing a teammate will hit, and nothing blocks it.

- **"Forgot password?" link** on the sign-in form (`auth-gate.jsx`) that calls
  `sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin })`
  and shows "Check your email" (same style as the sign-up confirmation note).
- **Set-password screen.** Listen for the `PASSWORD_RECOVERY` event in
  `supabase-client.js` `onAuthStateChange` (it currently ignores the event
  type) and render a new-password form instead of the app until
  `sb.auth.updateUser({ password })` succeeds. Confirm the fragment is cleared
  afterwards so a reload doesn't re-trigger it.
- **Change password while signed in.** Small form on the user's own row in
  /admin (or a menu item in the shell), also via `updateUser`.
- Supabase side: the redirect URL must be in Auth → URL Configuration
  (Site URL is already `https://rcis-dash.vercel.app`; add
  `http://localhost:4173` for dev).
- Verify with the real email flow on the live site, and check that a used
  recovery link can't be replayed.

### Financials page

The page exists at `/financials` with the margin calculator and the
Specialty settings section (lifted from /admin). Remaining: the
**reporting rollup** — company-wide earned revenue, gross/net margin, and
projections, broken down by company total / district / specialty /
contractor. Depends on a monthly time-entries CSV import from the time
tracker; build after that import exists. Fully scoped in
`docs/financials-page-scope.md`.

### Security gate — before real data migration

Found in the Oct 2026 security pass. Invite-only sign-up, the profile
identity guard, link-scheme checks, SRI, and the schema hardening shipped
then; password recovery is the "Next up" item above. These are the remaining
larger items that should land before real therapist / school data replaces
the mocks. Today any signed-in teammate has full read/write on everything
(RLS is `to authenticated using (true)`).

- **Enforce `active` in RLS.** Deactivating a teammate on /admin is cosmetic;
  they keep full access and could re-activate themselves via the open
  `team_profiles` update policy. Needs an `is_active_member()` helper used by
  every table policy, plus a guard so a user can't flip their own `active`.
  Ties into the "Roles" open question below.
- **Content-Security-Policy + production React.** No CSP headers in
  `vercel.json`; `index.html` loads React/ReactDOM development builds and
  compiles JSX in the browser. Add a CSP (script-src self + the four CDN
  hosts, connect-src the Supabase project) and switch to production builds.

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
- **System-sent invite email.** Invite-only access shipped (Oct 2026) via the
  sign-up trigger; what's left is the dashboard emailing the invitee instead
  of the admin sharing the URL out of band. Needs a Supabase Edge Function to
  hold the service-role key; deferred past the prototype.
- **Role-based permissions enforcement.**
