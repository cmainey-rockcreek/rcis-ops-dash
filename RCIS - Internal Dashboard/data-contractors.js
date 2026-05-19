// Enriched contractor records — adds contact info, licenses, rates, schedule,
// assignment history, documents, and notes on top of the base records in
// data.js. Splits into its own file so data.js stays focused on the dashboard
// summary data.
//
// All values are realistic-sounding fiction. Real RCIS data plugs in here
// (or via Supabase) later — same shape.

(function () {
  if (!window.RCIS_DATA) return;
  const { CONTRACTORS, SCHOOLS, DISTRICTS } = window.RCIS_DATA;

  // Deterministic pseudo-random from a string seed so re-renders produce the
  // same values for the same contractor. Not security-grade — just stable.
  function rng(seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
    }
    return () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return ((h >>> 0) % 10000) / 10000;
    };
  }
  function pick(rand, arr) { return arr[Math.floor(rand() * arr.length)]; }
  function int(rand, lo, hi) { return Math.floor(rand() * (hi - lo + 1)) + lo; }

  // ─── License kinds by specialty ───────────────────────────────────────────
  const LICENSE_KIND = {
    SLP:  'SLP',
    OT:   'OT',
    PT:   'PT',
    PSY:  'NCSP',
    BCBA: 'BCBA',
    MH:   'LCMHC',
    SPED: 'SPED-T',
  };

  // ─── Build email / phone from name + state ────────────────────────────────
  function emailOf(name) {
    const [first, last] = name.toLowerCase().split(' ');
    return `${first}.${(last || '').replace(/[^a-z]/g, '')}@rcis.example`;
  }
  function phoneOf(rand, state) {
    const areaCodes = {
      VA: ['703', '804', '757', '540'],
      NC: ['919', '704', '336', '252'],
      MD: ['301', '410', '443'],
      SC: ['843', '803', '864'],
      DC: ['202'],
      WV: ['304'],
    };
    const a = pick(rand, areaCodes[state] || ['703']);
    const b = int(rand, 200, 999);
    const c = int(rand, 1000, 9999);
    return `(${a}) ${b}-${c}`;
  }
  function cityOf(rand, state) {
    const cities = {
      VA: ['Reston', 'Fairfax', 'Arlington', 'Richmond', 'Alexandria', 'Vienna'],
      NC: ['Raleigh', 'Charlotte', 'Durham', 'Cary', 'Greensboro'],
      MD: ['Bethesda', 'Rockville', 'Silver Spring', 'Frederick'],
      SC: ['Charleston', 'Mt. Pleasant', 'Columbia'],
      DC: ['Washington'],
      WV: ['Morgantown', 'Charleston'],
    };
    return pick(rand, cities[state] || ['Reston']) + ', ' + state;
  }
  function npiOf(rand) {
    // NPIs are 10 digits. We don't check the Luhn variant — these are fakes.
    let s = '1';
    for (let i = 0; i < 9; i++) s += int(rand, 0, 9);
    return s;
  }

  // ─── Rates by specialty (typical band, slight per-contractor variance) ────
  const RATE_BAND = {
    SLP:  { hourly: [58, 78], bill: [88, 115] },
    OT:   { hourly: [60, 80], bill: [90, 120] },
    PT:   { hourly: [62, 82], bill: [92, 125] },
    PSY:  { hourly: [68, 92], bill: [100, 145] },
    BCBA: { hourly: [65, 88], bill: [95, 135] },
    MH:   { hourly: [55, 75], bill: [85, 110] },
    SPED: { hourly: [50, 70], bill: [78, 105] },
  };
  function ratesFor(rand, spec) {
    const band = RATE_BAND[spec] || RATE_BAND.SLP;
    return {
      hourly: int(rand, band.hourly[0], band.hourly[1]),
      bill:   int(rand, band.bill[0],   band.bill[1]),
    };
  }

  // ─── Licenses ─────────────────────────────────────────────────────────────
  function licensesFor(rand, spec, states) {
    const kind = LICENSE_KIND[spec] || spec;
    return states.map((st) => {
      // Expiration spread across the next 6-24 months.
      const monthsAhead = int(rand, 2, 22);
      const d = new Date(2026, 5 + monthsAhead, int(rand, 1, 28));
      const iso = d.toISOString().slice(0, 10);
      return {
        state: st,
        kind,
        number: `${st}-${kind}-${int(rand, 10000, 99999)}`,
        expires: iso,
      };
    });
  }

  // ─── Weekly schedule (4 blocks × 5 days, 0-3 load) ────────────────────────
  function scheduleFor(rand, cap, assigned) {
    const intensity = Math.min(1, assigned / cap);
    const grid = [];
    for (let b = 0; b < 4; b++) {
      const row = [];
      for (let d = 0; d < 5; d++) {
        if (b === 3) {                                      // LATE — usually empty
          row.push(rand() < 0.1 ? 1 : 0);
        } else if (b === 1) {                               // MID — mixed
          const r = rand();
          row.push(r < 0.45 * intensity ? 2 : r < 0.75 ? 1 : 0);
        } else {
          const r = rand();
          row.push(r < 0.55 * intensity ? 3 : r < 0.85 ? 2 : r < 0.95 ? 1 : 0);
        }
      }
      grid.push(row);
    }
    return grid;
  }

  // ─── Assignments (current + historical) ───────────────────────────────────
  function assignmentsFor(rand, c) {
    // Number of current schools comes from the base record.
    const current = c.schools || 3;
    const out = [];
    // Pool of schools that match a state this contractor works in.
    const pool = (SCHOOLS || []).filter((s) => c.states.includes(s.state));
    if (pool.length === 0) return [];

    // Pull contractor name as seed entropy so different contractors pick
    // different subsets of the pool.
    const used = new Set();
    const picks = [];
    let attempts = 0;
    while (picks.length < current && attempts < 50) {
      const s = pool[Math.floor(rand() * pool.length)];
      if (!used.has(s.id)) { used.add(s.id); picks.push(s); }
      attempts++;
    }

    // Current assignments — split hours across schools roughly.
    const totalDirect  = Math.round(c.assigned * 0.78);
    const totalIndirect = c.assigned - totalDirect;
    let remainingDirect = totalDirect, remainingIndirect = totalIndirect;
    picks.forEach((s, i) => {
      const isLast = i === picks.length - 1;
      const direct   = isLast ? remainingDirect   : Math.max(2, Math.round((rand() * totalDirect) / current * 1.5));
      const indirect = isLast ? remainingIndirect : Math.max(0, Math.round((rand() * totalIndirect) / current * 1.5));
      remainingDirect   = Math.max(0, remainingDirect - direct);
      remainingIndirect = Math.max(0, remainingIndirect - indirect);
      out.push({
        schoolId: s.id,
        school: s.name,
        district: (DISTRICTS.find((d) => d.id === s.district) || {}).name || s.state,
        state: s.state,
        startDate: `2025-${pick(rand, ['08', '09', '10', '11'])}-${String(int(rand, 1, 28)).padStart(2, '0')}`,
        endDate: null,
        hoursPerWeek: direct + indirect,
        direct,
        indirect,
        status: 'active',
      });
    });

    // Past assignments (1-3 ended). Pull from outside the current pool when
    // possible, so the history actually adds info.
    const histCount = int(rand, 1, 3);
    const histPool = pool.filter((s) => !used.has(s.id));
    for (let i = 0; i < histCount && i < histPool.length; i++) {
      const s = histPool[Math.floor(rand() * histPool.length)];
      if (used.has(s.id)) continue;
      used.add(s.id);
      const yearStart = pick(rand, ['2023', '2024', '2024', '2024']);
      const yearEnd   = pick(rand, ['2024', '2024', '2025']);
      out.push({
        schoolId: s.id,
        school: s.name,
        district: (DISTRICTS.find((d) => d.id === s.district) || {}).name || s.state,
        state: s.state,
        startDate: `${yearStart}-08-${String(int(rand, 15, 28)).padStart(2, '0')}`,
        endDate:   `${yearEnd}-06-${String(int(rand, 1, 14)).padStart(2, '0')}`,
        hoursPerWeek: int(rand, 4, 12),
        direct:   int(rand, 3, 9),
        indirect: int(rand, 1, 3),
        status: 'completed',
      });
    }

    return out;
  }

  // ─── Supporting documents ─────────────────────────────────────────────────
  // Common docs we keep on every contractor. URLs are placeholders.
  function documentsFor(rand, c, spec) {
    const baseT = Date.now() - int(rand, 30, 540) * 86400000;
    return [
      { id: 'd1', kind: 'pdf',    name: 'Background check (BIA)',     url: 'https://drive.google.com/file/d/example-bg-check', addedAt: baseT },
      { id: 'd2', kind: 'pdf',    name: `${LICENSE_KIND[spec] || spec} license — primary state`, url: 'https://drive.google.com/file/d/example-license', addedAt: baseT + 86400000 },
      { id: 'd3', kind: 'pdf',    name: 'Liability insurance certificate', url: 'https://drive.google.com/file/d/example-liability', addedAt: baseT + 172800000 },
      { id: 'd4', kind: 'gdoc',   name: 'Signed contractor agreement', url: 'https://docs.google.com/document/d/example-agreement', addedAt: baseT + 259200000 },
      { id: 'd5', kind: 'gsheet', name: 'W-9 + direct deposit form',   url: 'https://docs.google.com/spreadsheets/d/example-w9', addedAt: baseT + 345600000 },
    ];
  }

  // ─── Hire date ────────────────────────────────────────────────────────────
  function hireDateFor(rand) {
    const year = pick(rand, ['2021', '2022', '2022', '2023', '2023', '2024', '2024', '2025']);
    const month = String(int(rand, 1, 12)).padStart(2, '0');
    const day = String(int(rand, 1, 28)).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // ─── Public: enrich a contractor record ───────────────────────────────────
  // Idempotent — calling twice yields the same record.
  function enrich(c) {
    if (c.__enriched) return c;
    const rand = rng(c.id + c.name);
    const primaryState = c.states[0] || 'VA';
    const rates = ratesFor(rand, c.spec);
    const enriched = {
      ...c,
      email: emailOf(c.name),
      phone: phoneOf(rand, primaryState),
      city: cityOf(rand, primaryState),
      npi: npiOf(rand),
      hireDate: hireDateFor(rand),
      rates,
      licenses: licensesFor(rand, c.spec, c.states),
      schedule: scheduleFor(rand, c.cap, c.assigned),
      assignments: assignmentsFor(rand, c),
      documents: documentsFor(rand, c, c.spec),
      notes: '',
      __enriched: true,
    };
    return enriched;
  }

  // Enrich all contractors in-place so the existing 15-contractor data shows
  // up with full details everywhere.
  for (let i = 0; i < CONTRACTORS.length; i++) {
    CONTRACTORS[i] = enrich(CONTRACTORS[i]);
  }

  // ─── Add 15 more contractors so the list page feels populated. ────────────
  const MORE = [
    { id: 'c16', name: 'Sienna Russo',    spec: 'SLP',  cap: 28, assigned: 24, status: 'partial', states: ['VA'],      schools: 5 },
    { id: 'c17', name: 'Theo Hwang',      spec: 'PSY',  cap: 32, assigned: 30, status: 'partial', states: ['MD','DC'], schools: 4 },
    { id: 'c18', name: 'Mira Achebe',     spec: 'OT',   cap: 25, assigned: 25, status: 'full',    states: ['NC'],      schools: 4 },
    { id: 'c19', name: 'Bennett Ross',    spec: 'MH',   cap: 30, assigned: 16, status: 'avail',   states: ['SC','NC'], schools: 3 },
    { id: 'c20', name: 'Lara Voss',       spec: 'BCBA', cap: 32, assigned: 28, status: 'partial', states: ['VA','MD'], schools: 5 },
    { id: 'c21', name: 'Felix Marchetti', spec: 'SLP',  cap: 30, assigned: 8,  status: 'avail',   states: ['VA'],      schools: 2 },
    { id: 'c22', name: 'Naomi Berhane',   spec: 'PT',   cap: 24, assigned: 22, status: 'partial', states: ['DC','VA'], schools: 4 },
    { id: 'c23', name: 'Wesley Olsen',    spec: 'SPED', cap: 35, assigned: 32, status: 'partial', states: ['NC','VA'], schools: 6 },
    { id: 'c24', name: 'Anya Petrov',     spec: 'OT',   cap: 30, assigned: 0,  status: 'pto',     states: ['MD'],      schools: 3 },
    { id: 'c25', name: 'Jamal Foster',    spec: 'PSY',  cap: 28, assigned: 12, status: 'avail',   states: ['VA','NC'], schools: 3 },
    { id: 'c26', name: 'Calla Whitfield', spec: 'SLP',  cap: 25, assigned: 25, status: 'full',    states: ['NC'],      schools: 4 },
    { id: 'c27', name: 'Reza Khalil',     spec: 'MH',   cap: 30, assigned: 26, status: 'partial', states: ['VA','MD'], schools: 5 },
    { id: 'c28', name: 'Ines Coronado',   spec: 'BCBA', cap: 28, assigned: 14, status: 'avail',   states: ['SC'],      schools: 3 },
    { id: 'c29', name: 'Hollis Park',     spec: 'OT',   cap: 32, assigned: 30, status: 'partial', states: ['VA','DC'], schools: 6 },
    { id: 'c30', name: 'Tobias Reinhardt',spec: 'SPED', cap: 30, assigned: 22, status: 'avail',   states: ['MD','VA'], schools: 4 },
  ];
  for (const c of MORE) CONTRACTORS.push(enrich(c));

  // Expose enrich for any later-added records.
  window.enrichContractor = enrich;
  // Helper: find a contractor by id.
  window.getContractor = (id) => CONTRACTORS.find((c) => c.id === id);
})();
