# RCIS Dashboard — Assignments Master Page Scope

_Reference document. Produced from a planning session, Oct 9, 2026. Scope for
the `#/assignments` master list (SPEC.md "Assignments master page"). The plan
was approved by the owner but the build was deferred. This is the build brief
for whoever picks it up._

---

## Why

An assignment (contractor → school or district) is visible only on that
contractor's detail page. The school and district pages show only the mock
seed rows, so a saved Supabase assignment appears nowhere except under its
contractor. The owner wants one page that answers "which schools have which
contractors" across the whole company.

## Owner decisions (confirmed Oct 9, 2026)

- **Default layout: grouped by school.** Sections ordered by district name,
  then school name. District-wide assignments (`schoolId` null, `districtId`
  set) get their own section per district labelled "<District> ·
  district-wide", placed first within that district. A header toggle
  ("By school / Table") switches to a **flat sortable table**, one row per
  assignment. Filters persist across the toggle.
- **Row columns:** contractor (initials avatar tinted by spec, name, spec
  chip), direct h, indirect h, start / end dates, **weekly gross margin**.
  Flat view adds a School / District column. **No pay or bill rate columns.**
- **Page totals** under the header: "N assignments · X h/week · $Y weekly
  margin", summed over visible *active* rows only.
- **Completed hidden by default.** A "Show completed" chip reveals them at
  reduced opacity, with margin shown as "—".
- **Filters:** search (contractor / school / district name), specialty chips,
  district select.
- **Actions:** click a saved (Supabase) row to open the existing
  AssignmentEditor; mock seed rows are read-only with a SEED tag. "New
  assignment" button: pick a contractor first, then the editor opens
  prefilled. "Export CSV" downloads the currently visible rows.
- **Not changed:** `supabase/schema.sql`, the dashboard, the editor's
  internals, the school and district pages.

## Done-checklist for the owner

1. Open `/assignments`: every school with a contractor is listed with its
   contractors; district-wide assignments appear under "<District> ·
   district-wide".
2. Click a saved assignment, change direct hours, save: the row updates here
   and on the contractor's page.
3. "New assignment" → pick a contractor → pick a school → save: it appears in
   the right school section and on the contractor page.
4. "Export CSV" downloads a file matching what is on screen.

## Facts the build depends on (verified Oct 9, 2026)

- `window.useAssignments()` (`assignments-store.js`) returns saved rows only:
  `{id, contractorId, contractorName, schoolId, schoolName, districtId,
  districtName, spec, directHours, indirectHours, indirectOverride, payRate,
  startDate, endDate, status('active'|'completed'), note, attachments,
  schedule, source:'supabase'}`.
- Mock seed rows live on `contractor.assignments` (built by `assignmentsFor`
  in `data-contractors.js`): `{schoolId, school, district (NAME, not id),
  state, startDate, endDate, hoursPerWeek, direct, indirect, status}`. No id,
  spec, payRate or districtId. Always school-scoped.
- `window.useContractorAssignments(c)` merges both shapes for ONE contractor.
  `dashboard-calm.jsx` (the revenue tile) merges across all contractors
  inline. There is no shared "all assignments" hook yet.
- `AssignmentEditor` (`page-contractors.jsx`) is file-private. Props:
  `{assignment, isNew, pal, onSave, onDelete, onClose}`. It closes over
  file-private helpers (`modalStyles`, `AssignmentAttachments`, `Th`,
  `formatDate`), so exporting the function alone is enough.
- Bug found in passing: `AssignmentTable` in `page-contractors.jsx` reads
  `a.districtName` for district-wide rows, but merged rows carry `district`,
  so those rows render "—" instead of "<District> (district-wide)".
- The three "Export CSV" buttons on contractors / schools / districts have no
  handler, and nothing in the repo builds a CSV yet.
- Money: `window.ContractorFinancials.weeklyMargin(rows, {pay, spec})` is
  gross margin over *active* rows only (returns 0 for a completed row).
  `effectiveBill` resolves the district rate card from the row's
  `schoolId` / `districtId` / `spec`; `effectivePay` uses `row.payRate` else
  `defaults.pay`. Contractor default pay is `c.rates.hourly` after
  `applyContractorOverride`. A user-created contractor with no pay rate has
  `rates.hourly = 0`, so its margin equals the full bill (same as the
  contractor page today).
- Sidebar nav is the `NAV` array in `CalmSidebar` (`shell-calm.jsx`). The
  `school` icon (graduation cap) in `shared.jsx` is unused in the nav.
- A new route needs three registrations: `parse()` in `router.jsx`, the
  `App` dispatch in `index.html`, and the `NAV` array. The script tag goes
  after `page-financials.jsx` with `type="text/babel"`.

## Build steps (each leaves the app loadable; check the console after each)

1. **Shared hook in `assignments-store.js`.** Add `window.allAssignmentRows(
   persisted, contractors, overridesMap)` (pure) and `window.useAllAssignments()`
   (subscribes to assignments, contractors, contractor overrides, spec
   settings, district rate cards, school and district overrides; memoizes).
   Normalized row: `{key, _id, source, contractorId, contractorName, spec,
   schoolId, schoolName, districtId, districtName, state, direct, indirect,
   indirectOverride, payRate, defaultPay, startDate, endDate, status,
   attachmentCount}`. Mirror the merge rules in `useContractorAssignments`:
   indirect is re-derived via `AssignmentsStore.autoIndirect` unless
   overridden; `districtId` via `window.assignmentDistrictId`; names via
   `contractorDisplayName` / `schoolDisplayName` / `districtDisplayName`
   with the stored snapshot as fallback. Saved rows whose contractor is not
   in the catalog are still emitted so nothing silently disappears.
2. **`window.downloadCSV(filename, headerRow, rows)` in `shared.jsx`.** Quote
   cells containing `,` `"` CR LF (double inner quotes), join with CRLF,
   prefix a UTF-8 BOM, Blob → object URL → temporary `<a download>` → revoke.
3. **`page-contractors.jsx`:** add `window.AssignmentEditor = AssignmentEditor`
   and `window.assignmentModalStyles = modalStyles` next to the existing
   exports; fix the `a.districtName` → `a.district` bug in `AssignmentTable`.
4. **Route + nav + skeleton.** `router.jsx`, `index.html`, `shell-calm.jsx`
   (nav entry between Districts and Matchmaker, badge = active count from
   `useAllAssignments`, guarded like the other sidebar hooks). New
   `page-assignments.jsx` with `AssignmentsPage({dark})` → `PageShell
   activePage="assignments"` → `AssignmentsList({pal})`. Copy the file-private
   list helpers (`SortHeader`, `FilterGroup`, `btnPrimary`, `btnSecondary`,
   `formatDateShort`) from `page-contractors.jsx`, as the other list pages do.
5. **Grouped view + totals + show-completed.** One `useMemo` builds visible
   rows and attaches per-row `weeklyMargin` (`F.weeklyMargin([row], {pay:
   row.defaultPay, spec: row.spec})`, per row because default pay differs
   per contractor) and `weeklyHours`. Group key `schoolId ? 's:'+schoolId :
   'd:'+districtId`. Section header style from GlobalSearch in
   `shell-calm.jsx` (uppercase 10px, "LABEL · n"). Table card is its own
   scroll container like the contractors list.
6. **Filters.** Search card, spec `FilterGroup` from `RCIS_DATA.SPECIALTIES`,
   district `<select>` from `useDistrictsView(RCIS_DATA.DISTRICTS)`.
7. **Flat view + sorting.** Sort keys: contractor, spec, place, direct,
   indirect, start, end, margin (margin sorts on the precomputed value).
8. **Edit flow.** Click Supabase row → `AssignmentsStore.get().find(id)` →
   `<window.AssignmentEditor>` with the save / delete handlers copied from
   `AssignmentsCard`. Mock rows: no cursor, no click.
9. **New assignment.** File-private `ContractorPickerModal` (uses
   `window.assignmentModalStyles`; search over `useContractorsView(
   useContractors())`). On pick, open the editor with the same draft
   `AssignmentsCard.openNew` builds: `{contractorId, contractorName, spec,
   payRate: c.rates.hourly, startDate: today, status:'active'}`. The editor
   itself is unchanged. Known limitation, unchanged from today: an
   assignment cannot be moved to a different contractor.
10. **Export CSV.** Columns: Contractor, Specialty, School, District, Scope
    (school / district-wide), Direct h, Indirect h, Weekly h, Start, End,
    Status, Weekly margin, Source (supabase / seed). Visible rows, display
    order. Filename `assignments-YYYY-MM-DD.csv`.
11. **Docs + ship.** Add the route to the `CLAUDE.md` route table and the new
    globals to its lists. Delete the SPEC.md item in the shipping commit and
    add a Polish follow-up: switch the dashboard's inline merge to
    `allAssignmentRows`. Note under "Data export to CSV" that `downloadCSV`
    now exists for the placeholder buttons. Full pass light + dark, every
    route, console clean, no horizontal overflow at 1440px. `/code-review`.
    No `/security-review` needed (no auth, RLS, schema or Storage changes).

## Things that bite

- Babel compiles in the browser: one syntax error blanks the whole app.
- `ContractorFinancials.activeRows` is strict `status === 'active'`; never
  pass a completed row expecting a number.
- `useAllAssignments` must subscribe to `useContractors()` and
  `useContractorOverrides()` or renames and pay overrides will not re-render.
- Keep the `window.X ? window.X() : fallback` guard in the sidebar badge so
  the shell still renders if a store fails to load.
