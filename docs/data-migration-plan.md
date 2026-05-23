# RCIS Dashboard — Real Data Migration Plan

_Reference document. Produced from a planning session, May 2026. This is the
input for a future migration brief — it is not itself a build brief. Nothing
here should be built until a dedicated brief is written and approved._

---

## Why this exists

The RCIS Internal Dashboard currently runs on mock catalogs (`data.js`,
`data-contractors.js`, `data-schools.js`). Real RCIS data — roughly 50
therapists and 250+ schools — is scattered across Gusto, QuickBooks, a time
tracker, Google Sheets, clinician folders in Google Drive, and an Excel
spreadsheet.

This document defines three things: what real data belongs in the dashboard,
where each field comes from, and how to load it without corrupting it.

---

## Guiding principle — the dashboard is an operational layer, not a master database

The dashboard does not replace your existing systems. Gusto stays the system of
record for payroll and HR. QuickBooks stays the record for accounting. The time
tracker stays the record for hours worked. The dashboard pulls the *operational
subset* of that data into one place — who the contractors are, where they're
assigned, the schools and districts, coverage, renewals, tasks.

This matters for one reason: if the dashboard tries to *own* data that another
system already owns, you end up with two sources of truth that drift apart.
Until live integrations exist (see Deferred work), the dashboard holds a
periodic *snapshot* of this data, and keeping it current is a manual process —
see Ongoing maintenance.

---

## Source-of-truth map

Four entities. Every field maps to exactly one authoritative source. When two
systems disagree, the source named here wins.

### Contractors (therapists)

| Field | Source |
|---|---|
| Name | Gusto |
| Email | Gusto |
| Phone | Gusto |
| Location (city, state) | Gusto |
| Specialty | Gusto (mapped to one of the 7 dashboard codes) |
| Licensed states | Clinician folder PDFs — Google Drive |
| Licenses (type, number, expiry — per state) | Clinician folder PDFs — Google Drive |
| NPI number | Clinician folders — Google Drive |
| Start date | Gusto |
| Pay rate (hourly) | Gusto |
| Delivery modality (tele / onsite / both) | Google Sheet |
| Weekly capacity (hrs/week) | Monthly therapist capacity spreadsheets — Google Sheets |
| Active status | Gusto |
| Documents (background check, license, agreement, W-9) | Google Drive — links, not files |

_Operational — created in the dashboard, not migrated: the weekly schedule grid, free-text notes._

### Assignments — who is placed where

Seeded once, after the three catalogs are loaded.

| Field | Source |
|---|---|
| Contractor ↔ school placement | Time tracker (tracks at the school level) |
| District | Derived from the school |
| Hours — direct / indirect | Time tracker |
| Start / end date | Time tracker |
| Bill rate | Derived — district rate card × the contractor's specialty |

### Districts

| Field | Source |
|---|---|
| Name | Google Sheet |
| State | Google Sheet |
| Rate card — bill rate per specialty | QuickBooks |
| Contract / MSA — status, signed date, term, renewal date, PO # | District folders in Google Drive (signed PDFs; no separate tracker today) |
| Documents — MSA, COI, scope letters | District folders in Google Drive |

### Schools

| Field | Priority | Source |
|---|---|---|
| Name | Essential | Time tracker (compiled into a clean list) |
| District | Essential | Compiled school→district map — must be built |
| State | Essential | Inherited from the district |
| Address / city / zip | Useful | NCES (or a master list) |
| Grade band | Nice-to-have | NCES |
| Student count | Nice-to-have | NCES |
| Main phone | Useful | NCES (or a master list) |
| School contacts — principal, SPED coordinator (name, role, email, phone) | Useful | Google Sheet |
| Documents | Useful | Google Drive |

_Operational — not migrated: coverage gaps, free-text notes._

**Note on contacts:** school contacts ride with the school record. If the
dashboard's standalone Contacts list is meant to hold anything beyond
school and district contacts, confirm that before the migration.

---

## Key data-model decisions made in this session

1. **Bill rate is not a contractor field.** It is set per (district ×
   specialty): every SLP in a given district bills at the same rate, and the
   rate per specialty varies by district. Model it as a **district rate card**
   (specialty → rate). Each assignment derives its bill rate from its district
   plus the contractor's specialty — it is looked up, not stored.

2. **Contracts/MSAs belong to the district, not the school.** RCIS bills by
   district. Contract status, renewal date, and terms are district-level
   fields.

3. **Weekly capacity should eventually auto-update** from the monthly capacity
   spreadsheets therapists fill out, rather than being a static field.

---

## Anti-corruption fundamentals

At ~250 schools and ~50 therapists this is a small migration. The risk is not
volume — it is discipline. Six rules:

1. **Stable IDs are the anchor.** Every district, school, and contractor gets a
   permanent ID, assigned once in the spreadsheet before import. The ID never
   changes. Every relationship and every future edit hangs off the ID, not the
   name.
2. **Load in dependency order.** Districts first, then schools (each pointing at
   a district ID that already exists), then contractors, then assignments.
3. **One clean row per real thing.** De-duplicate in the spreadsheet. Decide the
   canonical format for every field up front — state abbreviations, phone
   format, and especially specialty codes.
4. **Validate before you write.** A dry run that reads the cleaned spreadsheets
   and lists every problem — missing district, unmapped specialty, duplicate
   ID, blank required field — without changing anything. Fix, re-run, repeat
   until the list is empty.
5. **Back up before you write.** Snapshot the Supabase tables first, so there is
   an undo if rows go in wrong.
6. **Clean cutover, not coexistence.** The migration deletes the mock catalogs
   entirely and makes real rows the only source. Never run real data and mock
   data side by side — that blend *is* the corruption.

---

## Data preparation — the real work

Most of "not corrupted" is won here, in spreadsheets, before anything technical
happens.

- **Master school→district map (critical path).** There is no clean list today
  of which school belongs to which district. Pull the distinct schools from the
  time tracker, de-duplicate the names, assign each school a stable ID, and
  assign each to a district *by district ID* (not by typing the district name).
  This compiled sheet is the backbone of the whole schools migration.
- **District sheet.** Start from the district Google Sheet. Assign each district
  a stable ID and confirm its state. Add the rate card (specialty → bill rate)
  from QuickBooks. Record each district's contract renewal date — read once
  from the MSA PDFs in that district's Google Drive folder.
- **Contractor sheet.** Export from Gusto (name, email, phone, location,
  specialty, start date, pay rate, active status). Add licensed states and NPI
  from the clinician folder PDFs. Add delivery modality and weekly capacity from
  the Google Sheets. Assign each contractor a stable ID.
- **Specialty mapping.** Decide explicitly how Gusto's specialty labels map to
  the 7 dashboard codes — SLP, OT, PT, PSY, BCBA, MH, SPED. Every contractor
  must land on exactly one code.
- **Assignments sheet.** From the time tracker — one row per placement,
  referencing a contractor ID and a school ID, with direct/indirect hours and
  start/end dates.

---

## Migration sequence

The migration has a **data half** (spreadsheet work, done by the RCIS team) and
a **code half** (schema and app changes, done with Claude Code). They must come
together — the cutover should be one coordinated change so the app is never in
a half-mock, half-real state.

1. **Data prep** — produce the four cleaned spreadsheets above. (Data half.)
2. **Schema** — add real `districts`, `schools`, and `contractors` tables to
   `supabase/schema.sql`, following the create / trigger / realtime / RLS
   pattern. The `assignments` table already exists. (Code half.)
3. **Validate** — dry-run the cleaned spreadsheets: every reference resolves, no
   duplicate IDs, every specialty mapped, required fields present. Fix and
   re-run until clean.
4. **Back up** — snapshot the Supabase database.
5. **Load** — write the data in dependency order: districts → schools →
   contractors → assignments. Verify row counts after each.
6. **Code cutover** — switch the contractor / school / district stores to read
   from the new tables; retire the override tables (`contractor_overrides`,
   `school_overrides`, `district_overrides`), whose only job was to patch the
   mocks; delete `data.js`, `data-contractors.js`, `data-schools.js`.
7. **Verify** — every page loads with no console errors, relationships hold
   (schools roll up to districts, assignments resolve, bill rates compute), and
   a spot-check of ~10 records matches the source data.

This is large enough to be its own multi-phase brief.

---

## Ongoing maintenance

Until integrations exist, the dashboard is a snapshot, not a live feed. The
source-of-truth map above doubles as the maintenance instruction: when a field
changes in its source system, someone updates the dashboard. Decide who owns
each refresh and how often — for example, a new contractor is entered in the
dashboard at the same time as Gusto; rate cards are reviewed monthly.

---

## Deferred work

- **NCES integration.** School descriptive fields (address, grade band,
  enrollment, phone) are public NCES data. The migration can load a *thin*
  school list — name, district, state — and let an NCES lookup fill the rest
  later. This keeps the schools migration light.
- **Gusto integration.** Eventually, push contractor data from Gusto into the
  dashboard automatically instead of manually snapshotting it. This is the
  long-term endpoint and removes the manual-maintenance burden above.

---

## Open items to resolve before the migration brief

- **Specialty mapping** — confirm the exact specialty values used in Gusto and
  how each maps to the 7 dashboard codes.
- **Standalone Contacts list** — confirm whether it holds anything beyond school
  and district contacts.
- **School descriptive fields** — decide for the first version: load a thin
  school list and let NCES fill address/grade/enrollment later, or compile
  those now.
- **Bill rate model change** — removing the contractor-level bill rate and
  adding a district rate card is an app change that should land before or with
  the migration, since the migration assumes it.
