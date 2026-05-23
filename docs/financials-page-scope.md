# RCIS Dashboard — Financials Page Scope

_Reference document. Produced from a planning session, May 2026. Scope for the
Financials page (SPEC.md item 6). This is the input for a future build brief —
it is not itself a build brief._

---

## Overview

A new page in the dashboard, with three parts:

1. A **reporting rollup** — the company-wide revenue and margin picture.
2. A **margin calculator** — a what-if tool for evaluating new deals.
3. The **Specialty settings** section, moved here from the Admin page.

The rollup primarily serves Mark (accounting / operations) and Kathleen
(founder); the calculator primarily serves Christo (recruitment / partnerships).

---

## Part 1 — Reporting rollup

Shows the company's financial picture as a **current snapshot** — no historical
trend lines.

**Numbers shown:**

- **Earned revenue** — actual hours worked, school-year-to-date, × bill rate.
- **Gross margin** — earned revenue − pay.
- **Net margin** — earned revenue − pay − burden.
- **Projections** — annualized run-rate from current assignments; the
  forward-looking counterpart to earned revenue.

**Breakdowns** — the same numbers, four ways:

- Company total
- By district
- By specialty
- By contractor

**Definitions and sources:**

- Earned revenue uses *actual* hours from the time tracker (see Data
  dependency below), not planned assignment hours.
- Bill rate comes from the district rate card × the contractor's specialty —
  the bill rate model, SPEC item 2. The rollup depends on that being in place.
- Burden comes from per-spec `spec_settings` (already built).
- Projections use planned assignment hours, annualized — distinct from earned
  revenue, which is actual.

**No target / benchmark margin yet.** Accounting is reworking its numbers and
will set margin targets later. Build the rollup to display the numbers cleanly
now, and leave a clean slot for a later red/green "above / below target"
signal — but do not build that signal this round.

---

## Part 2 — Margin calculator

A live what-if tool for evaluating new deals.

- **Inputs:** bill rate, pay rate, specialty (drives burden), hours per week.
- **Outputs:** gross and net margin per hour, margin %, weekly, annualized.
- **Live only** — nothing saved, no scenario comparison, no rate-card prefill.
- Self-contained: it reuses `financials.js` math and per-spec burden, takes no
  real data, and has **no dependency on the data migration**. It can be built
  first, independent of everything else on this page.

---

## Part 3 — Specialty settings (moved from Admin)

The existing Specialty settings section — indirect ratio, burden per billable
hour, rate bands — moves from the Admin page to this page, since it is
financial configuration. This also keeps the Admin page focused on people and
access.

---

## Data dependency — time-tracker actuals

Earned revenue needs *actual* hours worked, which live in the time tracker. The
dashboard does not have this data today.

- **No API assumed.** The time tracker exports cleanly to CSV.
- **Monthly cadence.** Therapists submit hours monthly, so the dashboard takes
  a **monthly CSV import** of time entries. (RCIS plans to change the
  monthly-submission process later — the import design should not hard-assume
  the cadence.)
- This is a **recurring import**, unlike the one-time catalog migration. It
  parallels the monthly capacity import (SPEC item 3); the two could share an
  import mechanism.
- The app already has CSV-import infrastructure for `schedule_slots`
  (`source='import'`, `import_batch_id`). The time-entries import should reuse
  or mirror that pattern rather than start from scratch.
- **The rollup cannot show real numbers until this import exists.** The
  calculator is unaffected.

---

## Build sequencing

- **Margin calculator** — buildable now, fully independent.
- **Specialty settings move** — small, buildable anytime.
- **Reporting rollup** — depends on two things first: the bill rate model /
  district rate card (SPEC item 2), and the monthly time-entries CSV import.
  Build after both.

---

## Open items for the brief

- **School-year start date** — defines the "school-year-to-date" window for
  earned revenue.
- **Time-entries CSV shape** — confirm the columns once a sample export from
  the time tracker is available.
- **Import table** — decide whether time entries reuse the `schedule_slots`
  import path or get their own table.
- **Target margin %** — deferred; the rollup should leave a clean slot for an
  above / below-target signal to drop in later.
