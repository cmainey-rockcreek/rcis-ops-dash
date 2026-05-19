// Sample data for RCIS Dashboard prototype
// School-based therapists / specialists working across K-12 districts.
// All names/schools/dates are realistic-sounding fiction.

window.RCIS_DATA = (() => {
  const TEAM = [
    { id: 'sr', name: 'Sarah Reyes',     role: 'Operations',     initials: 'SR', color: '#1FA39A' },
    { id: 'mw', name: 'Marcus Whitfield', role: 'Contractors',   initials: 'MW', color: '#E76B5D' },
    { id: 'ep', name: 'Elena Park',      role: 'Partnerships',   initials: 'EP', color: '#1B2956' },
  ];

  const SPECIALTIES = [
    { code: 'SLP',  name: 'Speech-Language',     color: '#1FA39A' },
    { code: 'OT',   name: 'Occupational Therapy',color: '#E76B5D' },
    { code: 'PT',   name: 'Physical Therapy',    color: '#1B2956' },
    { code: 'PSY',  name: 'School Psychology',   color: '#7A5AE0' },
    { code: 'BCBA', name: 'Behavior Analysis',   color: '#C98A2C' },
    { code: 'MH',   name: 'Mental Health',       color: '#3E8A57' },
    { code: 'SPED', name: 'Special Ed',          color: '#5A6478' },
  ];

  // 48 contractors — surface a representative slice. Capacity is hrs/week.
  // status: 'avail' | 'full' | 'pto' | 'partial'
  const CONTRACTORS = [
    { id: 'c01', name: 'Anika Patel',      spec: 'SLP',  cap: 30, assigned: 22, status: 'avail',   states: ['VA','MD'], schools: 6 },
    { id: 'c02', name: 'Marcus Chen',      spec: 'OT',   cap: 25, assigned: 25, status: 'full',    states: ['NC'],      schools: 4 },
    { id: 'c03', name: 'Brielle Okonkwo',  spec: 'SLP',  cap: 30, assigned: 18, status: 'avail',   states: ['VA'],      schools: 5 },
    { id: 'c04', name: 'Daniel Rivera',    spec: 'PSY',  cap: 25, assigned: 24, status: 'partial', states: ['MD','DC'], schools: 3 },
    { id: 'c05', name: 'Yuki Tanaka',      spec: 'BCBA', cap: 28, assigned: 14, status: 'avail',   states: ['VA'],      schools: 4 },
    { id: 'c06', name: 'Janelle Brooks',   spec: 'MH',   cap: 30, assigned: 30, status: 'full',    states: ['NC','SC'], schools: 7 },
    { id: 'c07', name: 'Hassan Mahmoud',   spec: 'PT',   cap: 20, assigned: 0,  status: 'pto',     states: ['VA'],      schools: 2 },
    { id: 'c08', name: 'Priya Iyer',       spec: 'OT',   cap: 32, assigned: 26, status: 'partial', states: ['MD','VA'], schools: 6 },
    { id: 'c09', name: 'Cole Bergman',     spec: 'SPED', cap: 35, assigned: 28, status: 'avail',   states: ['NC'],      schools: 5 },
    { id: 'c10', name: 'Rosalind Kim',     spec: 'SLP',  cap: 25, assigned: 25, status: 'full',    states: ['VA','DC'], schools: 4 },
    { id: 'c11', name: 'Marco Delvecchio', spec: 'PSY',  cap: 30, assigned: 16, status: 'avail',   states: ['MD'],      schools: 3 },
    { id: 'c12', name: 'Tasha Greene',     spec: 'BCBA', cap: 24, assigned: 22, status: 'partial', states: ['VA'],      schools: 4 },
    { id: 'c13', name: 'Owen Whitlock',    spec: 'OT',   cap: 28, assigned: 12, status: 'avail',   states: ['NC','SC'], schools: 3 },
    { id: 'c14', name: 'Imani Forrest',    spec: 'MH',   cap: 30, assigned: 28, status: 'partial', states: ['VA','MD'], schools: 6 },
    { id: 'c15', name: 'Diego Marin',      spec: 'SLP',  cap: 32, assigned: 8,  status: 'avail',   states: ['VA'],      schools: 2 },
  ];

  const SCHOOLS_SAMPLE = [
    { name: 'Westbrook Elementary',     district: 'Loudoun County PS',      state: 'VA' },
    { name: 'Cedar Ridge Middle School',district: 'Wake County PS',         state: 'NC' },
    { name: 'North Hills Academy',      district: 'Montgomery County PS',   state: 'MD' },
    { name: 'Maple Glen K-8',           district: 'Fairfax County PS',      state: 'VA' },
    { name: 'Harborview High',          district: 'Charleston County SD',   state: 'SC' },
    { name: 'Pinecrest Elementary',     district: 'Wake County PS',         state: 'NC' },
    { name: 'Brookhaven Charter',       district: 'Independent',            state: 'DC' },
    { name: 'Stonebridge Middle',       district: 'Prince William County',  state: 'VA' },
  ];

  // Coverage gaps — unfilled assignments needing attention.
  const COVERAGE_GAPS = [
    { id: 'g1', school: 'Westbrook Elementary',     district: 'Loudoun County PS',   state: 'VA', spec: 'SLP',  hours: 12, posted: '4d',  priority: 'urgent', note: 'Anika Patel partial — needs co-coverage' },
    { id: 'g2', school: 'Cedar Ridge Middle',       district: 'Wake County PS',      state: 'NC', spec: 'OT',   hours: 8,  posted: '6d',  priority: 'urgent', note: 'Maternity leave, starts 6/1' },
    { id: 'g3', school: 'Harborview High',          district: 'Charleston County',   state: 'SC', spec: 'PSY',  hours: 15, posted: '2d',  priority: 'high',   note: 'New IEP load' },
    { id: 'g4', school: 'Pinecrest Elementary',     district: 'Wake County PS',      state: 'NC', spec: 'BCBA', hours: 10, posted: '9d',  priority: 'high',   note: '2 cancellations from c02' },
    { id: 'g5', school: 'Brookhaven Charter',       district: 'Independent',         state: 'DC', spec: 'MH',   hours: 6,  posted: '1d',  priority: 'medium', note: 'Add-on hours for Q4' },
    { id: 'g6', school: 'Stonebridge Middle',       district: 'Prince William',      state: 'VA', spec: 'SPED', hours: 20, posted: '11d', priority: 'medium', note: 'Long-term sub through year end' },
    { id: 'g7', school: 'Maple Glen K-8',           district: 'Fairfax County',      state: 'VA', spec: 'PT',   hours: 4,  posted: '14d', priority: 'low',    note: 'Low caseload — defer to fall?' },
  ];

  // Upcoming renewals/deadlines.
  const RENEWALS = [
    { id: 'r1', kind: 'License',  what: 'Janelle Brooks · NC LCMHC',    due: '2026-05-22', days: 4,  owner: 'mw' },
    { id: 'r2', kind: 'Contract', what: 'Wake County PS · Master MSA',  due: '2026-05-30', days: 12, owner: 'ep' },
    { id: 'r3', kind: 'License',  what: 'Marcus Chen · VA OT renewal',  due: '2026-06-08', days: 21, owner: 'mw' },
    { id: 'r4', kind: 'Insurance',what: 'Liability rider · all states', due: '2026-06-15', days: 28, owner: 'sr' },
    { id: 'r5', kind: 'Contract', what: 'Charleston County SD · Year 3',due: '2026-06-30', days: 43, owner: 'ep' },
  ];

  // Pinned notes between the 3 of you.
  const NOTES = [
    { id: 'n1', author: 'sr', text: "Heads up — Loudoun called, they want to add 2 SLP days. Marcus, can Anika stretch?", time: '9:14a', day: 'today' },
    { id: 'n2', author: 'mw', text: "Possibly. She's at 22/30 but I think 26 is the real ceiling. Will confirm by EOD.", time: '9:31a', day: 'today' },
    { id: 'n3', author: 'ep', text: "Wake County contract draft is in the shared drive — please review the indemnity clause before I send back.", time: 'Yesterday', day: 'yesterday' },
    { id: 'n4', author: 'sr', text: "Reminder: team sync moved to Thursday this week.", time: 'Mon',      day: 'mon' },
  ];

  // Kanban todos with multi-owner + optional links.
  // Schema:
  //   { id, title, column, owners[], label, priority, due, linkedTo: { type, id, name } | null, createdAt, updatedAt }
  // `due` is an ISO YYYY-MM-DD string or null. Cards seed at varying ages so
  // the Done column has a believable history when we wire localStorage.
  const TODOS_SEED = [
    // ── To do ──
    { id: 't01', title: 'Source 2 SLPs for Loudoun add-on',         column: 'todo',  owners: ['mw'],       label: 'Coverage',         priority: 'high',   due: '2026-05-21', linkedTo: { type: 'district', id: 'd5', name: 'Loudoun County PS' } },
    { id: 't02', title: 'Send revised MSA to Wake County legal',    column: 'todo',  owners: ['ep'],       label: 'Contracts',        priority: 'high',   due: '2026-05-22', linkedTo: { type: 'district', id: 'd1', name: 'Wake County PS' } },
    { id: 't03', title: 'Renew liability rider — all states',       column: 'todo',  owners: ['sr'],       label: 'Ops',              priority: 'medium', due: '2026-06-15', linkedTo: null },
    { id: 't04', title: 'Onboard Diego Marin (background check)',   column: 'todo',  owners: ['mw'],       label: 'Onboarding',       priority: 'medium', due: '2026-05-28', linkedTo: { type: 'contractor', id: 'c15', name: 'Diego Marin' } },
    { id: 't05', title: 'Reconcile April invoices',                 column: 'todo',  owners: ['sr'],       label: 'Finance',          priority: 'low',    due: null,         linkedTo: null },
    { id: 't06', title: 'Post BCBA listing for Pinecrest gap',      column: 'todo',  owners: ['mw'],       label: 'Recruiting',       priority: 'high',   due: '2026-05-24', linkedTo: { type: 'school', id: 's06', name: 'Pinecrest Elementary' } },

    // ── Doing ──
    { id: 't07', title: 'Confirm Janelle Brooks NC LCMHC renewal',  column: 'doing', owners: ['mw'],       label: 'Licensing',        priority: 'high',   due: '2026-05-22', linkedTo: { type: 'contractor', id: 'c06', name: 'Janelle Brooks' },
      notes: "Janelle confirmed she submitted the CE hours on 5/12. Waiting on state board acknowledgment — usually 5-7 business days. Will check status Wed.",
      attachments: [
        { id: 'a1', kind: 'gdoc',   url: 'https://docs.google.com/document/d/example1', name: 'Janelle Brooks — CE hours summary', addedAt: 1716000000000 },
        { id: 'a2', kind: 'pdf',    url: 'https://example.com/lcmhc-renewal-app.pdf',    name: 'NC LCMHC renewal application',      addedAt: 1716100000000 },
      ],
    },
    { id: 't08', title: 'Pinecrest BCBA replacement search',        column: 'doing', owners: ['mw', 'ep'], label: 'Coverage',         priority: 'high',   due: '2026-05-24', linkedTo: { type: 'school', id: 's06', name: 'Pinecrest Elementary' },
      notes: "Two candidates in pipeline:\n• Sarah Mendez — interview scheduled Thu 2pm\n• Brandon Lee — credentials pending, NC license active\n\nPrincipal Garcia would like to meet finalist before signing.",
      attachments: [
        { id: 'a3', kind: 'gsheet', url: 'https://docs.google.com/spreadsheets/d/example2', name: 'BCBA candidate tracker', addedAt: 1716200000000 },
      ],
    },
    { id: 't09', title: 'Q3 capacity forecast — draft',             column: 'doing', owners: ['sr'],       label: 'Planning',         priority: 'medium', due: '2026-05-30', linkedTo: null },
    { id: 't10', title: 'Charleston Year-3 renewal call',           column: 'doing', owners: ['ep'],       label: 'Contracts',        priority: 'medium', due: '2026-05-27', linkedTo: { type: 'district', id: 'd7', name: 'Charleston County SD' } },
    { id: 't11', title: 'Reply to Fairfax SLP coverage email',      column: 'doing', owners: ['ep'],       label: 'School comm',      priority: 'medium', due: '2026-05-20', linkedTo: { type: 'district', id: 'd2', name: 'Fairfax County PS' } },

    // ── Done ──
    { id: 't12', title: 'Verify Cole Bergman SPED endorsement',     column: 'done',  owners: ['mw'],       label: 'Licensing',        priority: 'medium', due: '2026-05-14', linkedTo: { type: 'contractor', id: 'c09', name: 'Cole Bergman' } },
    { id: 't13', title: 'Onboard Yuki Tanaka',                      column: 'done',  owners: ['mw'],       label: 'Onboarding',       priority: 'medium', due: '2026-05-12', linkedTo: { type: 'contractor', id: 'c05', name: 'Yuki Tanaka' } },
    { id: 't14', title: 'May payroll batch',                        column: 'done',  owners: ['sr'],       label: 'Finance',          priority: 'high',   due: '2026-05-15', linkedTo: null },
    { id: 't15', title: 'Send welcome packet to Brookhaven',        column: 'done',  owners: ['ep'],       label: 'School comm',      priority: 'low',    due: '2026-05-10', linkedTo: { type: 'school', id: 's07', name: 'Brookhaven Charter' } },
  ];

  // Legacy shape (still used by the dashboard widget as a fallback if the
  // localStorage store hasn't seeded yet).
  const TODOS = {
    todo:  TODOS_SEED.filter(t => t.column === 'todo'),
    doing: TODOS_SEED.filter(t => t.column === 'doing'),
    done:  TODOS_SEED.filter(t => t.column === 'done'),
  };

  // Counts shown in stat cards.
  const STATS = {
    schools: 253,
    contractors: 48,
    openCoverage: 7,
    upcomingRenewals: 5,
  };

  // States we operate in (with counts).
  const STATES = [
    { code: 'VA', count: 92 },
    { code: 'NC', count: 64 },
    { code: 'MD', count: 41 },
    { code: 'SC', count: 28 },
    { code: 'DC', count: 18 },
    { code: 'WV', count: 10 },
  ];

  // Districts / organizations we contract with.
  const DISTRICTS = [
    { id: 'd1', name: 'Wake County PS',         state: 'NC', schools: 32 },
    { id: 'd2', name: 'Fairfax County PS',      state: 'VA', schools: 28 },
    { id: 'd3', name: 'Montgomery County PS',   state: 'MD', schools: 24 },
    { id: 'd4', name: 'Prince William County',  state: 'VA', schools: 21 },
    { id: 'd5', name: 'Loudoun County PS',      state: 'VA', schools: 18 },
    { id: 'd6', name: 'Mecklenburg County',     state: 'NC', schools: 16 },
    { id: 'd7', name: 'Charleston County SD',   state: 'SC', schools: 14 },
    { id: 'd8', name: 'DC Charter Network',     state: 'DC', schools: 11 },
  ];

  // Schools we serve (subset of the full 253 — enough for pickers/lists).
  const SCHOOLS = [
    { id: 's01', name: 'Westbrook Elementary',     district: 'd5', state: 'VA' },
    { id: 's02', name: 'Cedar Ridge Middle',       district: 'd1', state: 'NC' },
    { id: 's03', name: 'North Hills Academy',      district: 'd3', state: 'MD' },
    { id: 's04', name: 'Maple Glen K-8',           district: 'd2', state: 'VA' },
    { id: 's05', name: 'Harborview High',          district: 'd7', state: 'SC' },
    { id: 's06', name: 'Pinecrest Elementary',     district: 'd1', state: 'NC' },
    { id: 's07', name: 'Brookhaven Charter',       district: 'd8', state: 'DC' },
    { id: 's08', name: 'Stonebridge Middle',       district: 'd4', state: 'VA' },
    { id: 's09', name: 'Lakeview Elementary',      district: 'd2', state: 'VA' },
    { id: 's10', name: 'Riverside K-8',            district: 'd6', state: 'NC' },
    { id: 's11', name: 'Eastwood High',            district: 'd5', state: 'VA' },
    { id: 's12', name: 'Highland Elementary',      district: 'd3', state: 'MD' },
    { id: 's13', name: 'Oakwood Middle',           district: 'd1', state: 'NC' },
    { id: 's14', name: 'Foxcroft Academy',         district: 'd2', state: 'VA' },
    { id: 's15', name: 'Willow Creek Elementary',  district: 'd4', state: 'VA' },
    { id: 's16', name: 'Meadowbrook K-8',          district: 'd6', state: 'NC' },
    { id: 's17', name: 'Sycamore Elementary',      district: 'd5', state: 'VA' },
    { id: 's18', name: 'Birchwood Middle',         district: 'd3', state: 'MD' },
    { id: 's19', name: 'Ashton High',              district: 'd7', state: 'SC' },
    { id: 's20', name: 'Brightwood Charter',       district: 'd8', state: 'DC' },
    { id: 's21', name: 'Crestwood Elementary',     district: 'd2', state: 'VA' },
    { id: 's22', name: 'Larchmont Middle',         district: 'd1', state: 'NC' },
    { id: 's23', name: 'Glenside K-8',             district: 'd4', state: 'VA' },
    { id: 's24', name: 'Fairview Elementary',      district: 'd6', state: 'NC' },
    { id: 's25', name: 'Highview Academy',         district: 'd5', state: 'VA' },
    { id: 's26', name: 'Riverbend Middle',         district: 'd3', state: 'MD' },
    { id: 's27', name: 'Marshfield Elementary',    district: 'd1', state: 'NC' },
    { id: 's28', name: 'Hollybrook K-8',           district: 'd2', state: 'VA' },
    { id: 's29', name: 'Saddleback High',          district: 'd7', state: 'SC' },
    { id: 's30', name: 'Greenfield Elementary',    district: 'd5', state: 'VA' },
    { id: 's31', name: 'Hilltop Middle',           district: 'd4', state: 'VA' },
    { id: 's32', name: 'Bayshore Charter',         district: 'd8', state: 'DC' },
    { id: 's33', name: 'Ridgewood Elementary',     district: 'd6', state: 'NC' },
    { id: 's34', name: 'Stonewall K-8',            district: 'd3', state: 'MD' },
    { id: 's35', name: 'Plumtree Academy',         district: 'd1', state: 'NC' },
    { id: 's36', name: 'Whitlock Middle',          district: 'd2', state: 'VA' },
  ];

  // Categories a todo can be tagged with.
  const LABELS = [
    'Coverage',
    'Contracts',
    'Onboarding',
    'Licensing',
    'Ops',
    'Finance',
    'Planning',
    'School comm',
    'Contractor comm',
    'Recruiting',
  ];

  return { TEAM, SPECIALTIES, CONTRACTORS, SCHOOLS_SAMPLE, COVERAGE_GAPS, RENEWALS, NOTES, TODOS, TODOS_SEED, STATS, STATES, DISTRICTS, SCHOOLS, LABELS };
})();
