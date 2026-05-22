# RCIS Internal Dashboard: Build Plan

This is the working checklist for finishing the RCIS Internal Dashboard. It is a living document. Edit it freely: add items, reorder, cross things out.

## What we are building

An internal shared workspace and lightweight CRM for the RCIS operations team: Christo (Director of Recruitment & Partnerships), Kathleen (Founder), Mark (Accounting & Operations), and a future People Manager. The goal is one place where the whole team can see what is happening and track work together. It tracks roughly 30 to 50 active contractors and 250+ client schools. Internal use only. No contractors or district contacts log in.

## How to verify work

There is no automated test suite. After each item, verify by hand:

1. Start the dev server: `python3 -m http.server 4173` from the repo root.
2. Open `http://localhost:4173` in a browser.
3. Confirm the page loads with no errors in the browser console, and the change works as described.

Commit each completed item with a short, clear message. Check the item's box in this file when it is done and verified.

## How the loop should work through this

Work top to bottom, one item at a time. Implement an item, verify it, commit it, check its box, then move to the next. At the end of each Phase, stop and summarize what was done so Christo can review before the next Phase begins.

---

## Phase 1: Quick fixes and loose ends

Small, low-risk items. Finishing what is half-done.

- [ ] Add a "Schools" link to the sidebar navigation. The `CalmSidebar` NAV array in `shell-calm.jsx` is missing it, so the working Schools pages cannot be reached from the nav.
- [ ] Fix `TodosStore.byColumn()` in `todos-store.js`. Its output object is missing the `attention` column, so attention tasks would be dropped. Add `attention: []`.
- [ ] Resolve the "today" inconsistency. `RCIS_TODAY` is frozen at a mock date, while the Tasks page date math uses the real current date. Pick one source of truth for "today" and apply it consistently. See Open Questions.
- [ ] Tasks and Todos polish pass. The board is solid, so this is small refinements only, not new features. Review the board in normal daily use and fix any rough edges. (Christo: add any specific tweaks you want here.)

## Phase 2: Admin page

The main new build. A new page at route `#/admin` with a sidebar link.

- [ ] Foundation: create an `app_settings` store and a matching Supabase table so the settings below can be saved and shared across the team. Follow the store pattern in `todos-store.js`, and add the table to `supabase/schema.sql` using the create, trigger, realtime, and RLS steps.
- [ ] Scaffold the Admin page: create `page-admin.jsx`, register it in `index.html`, add the `admin` route to `router.jsx` and to the dispatch in `index.html`, and add a sidebar nav entry.
- [ ] Team members and roles: list everyone from `TeamStore` / `team_profiles` with name, email, and avatar. Add a role for each member (Director of Recruitment & Partnerships, Founder, Accounting & Operations, People Manager) that can be edited and saved.
- [ ] App settings: give a proper home to the theme default and the dashboard widget defaults that are currently hardcoded as `TWEAK_DEFAULTS` in `index.html`.
- [ ] Financial assumptions: editable fields for `WEEKS_PER_MONTH`, `WEEKS_PER_SCHOOL_YEAR`, and a new "overhead burden per billable hour" value. Wire `financials.js` to read these settings and to factor the overhead burden into margin math.
- [ ] Reference lists: let the team edit the fixed lists the app depends on: specialties (`RCIS_DATA.SPECIALTIES`), task categories (`RCIS_DATA.LABELS`), and renewal types.
- [ ] Data management: export contractors, schools, districts, and contacts to CSV. (Bulk import and real-data migration are parked. See Parking lot.)

## Phase 3: Global search and polish

- [ ] Make the top-bar search work. Today the search box is decorative. Make it search across contractors, schools, contacts, and tasks, and let a result navigate straight to that record.
- [ ] Page-by-page polish pass. Review each page (Dashboard, Matchmaker, Renewals, Contractors, Schools, Districts, Contacts) for rough edges, broken states, and visual inconsistency. Log anything larger as a new item rather than fixing it silently.

---

## Open questions: decide before or during the build

- "Today" source of truth: should the whole app use the real current date, or keep a frozen date for the mock dataset? Recommendation: use the real date everywhere, and regenerate the mock seed dates relative to today.
- Settings scope: should app and financial settings be shared org-wide (via the `app_settings` table) or set per user? Recommendation: org-wide for financial assumptions and reference lists, per user for theme.
- Roles: for now roles are just labels. Decide later whether they should control permissions.

## Parking lot: not now

- Migrating real RCIS data (real contractors, schools, districts, contacts) in place of the mock catalogs. This is a large effort and will be planned separately.
- Role-based permissions enforcement.
- Bulk data import on the Admin page.
