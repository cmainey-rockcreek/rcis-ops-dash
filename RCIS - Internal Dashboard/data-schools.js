// Enriched school records — contact info, contracts, addresses, grade band,
// student counts. Built on top of the SCHOOLS records in data.js using the
// same deterministic-rng pattern as data-contractors.js so values stay stable
// across renders.

(function () {
  if (!window.RCIS_DATA) return;
  const { SCHOOLS, DISTRICTS, CONTRACTORS } = window.RCIS_DATA;

  function rng(seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
    return () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return ((h >>> 0) % 10000) / 10000;
    };
  }
  function pick(rand, arr) { return arr[Math.floor(rand() * arr.length)]; }
  function int(rand, lo, hi) { return Math.floor(rand() * (hi - lo + 1)) + lo; }

  // ─── Realistic-sounding contact names ─────────────────────────────────────
  const FIRST = ['Sarah','Michael','Jennifer','David','Lisa','James','Maria','Robert','Patricia','John','Linda','Karen','Susan','Steven','Nancy','Mark','Betty','Donna','Carol','Daniel','Ruth','Paul','Sharon','Andrew','Michelle','Joshua','Laura','Kenneth','Sandra','Brian','Kimberly','George','Donna','Edward'];
  const LAST  = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright'];

  function makeName(rand) {
    return `${pick(rand, FIRST)} ${pick(rand, LAST)}`;
  }
  function emailOf(name, district) {
    const [first, last] = name.toLowerCase().split(' ');
    const slug = (district || 'schools').toLowerCase()
      .replace(/[^a-z]/g, '').slice(0, 8);
    return `${first[0]}${last}@${slug}.k12.example`;
  }
  function phoneOf(rand, state) {
    const areaCodes = {
      VA: ['703','804','757','540'], NC: ['919','704','336','252'],
      MD: ['301','410','443'], SC: ['843','803','864'],
      DC: ['202'], WV: ['304'],
    };
    return `(${pick(rand, areaCodes[state] || ['703'])}) ${int(rand, 200, 999)}-${int(rand, 1000, 9999)}`;
  }
  function addressOf(rand, state) {
    const streets = ['Oak St','Main St','Cedar Ave','Maple Dr','Elm Way','Pine Rd','Park Blvd','School Ln','Ridge Rd','Forest Ave'];
    const cities = {
      VA: ['Reston','Fairfax','Arlington','Richmond','Alexandria','Vienna','Sterling','Manassas','Leesburg'],
      NC: ['Raleigh','Charlotte','Durham','Cary','Greensboro','Apex','Wake Forest'],
      MD: ['Bethesda','Rockville','Silver Spring','Frederick','Gaithersburg','Potomac'],
      SC: ['Charleston','Mt. Pleasant','Columbia','Summerville'],
      DC: ['Washington'],
      WV: ['Morgantown','Charleston'],
    };
    return {
      street: `${int(rand, 100, 9999)} ${pick(rand, streets)}`,
      city: pick(rand, cities[state] || ['Reston']),
      zip: `${int(rand, 20000, 29999)}`,
    };
  }

  // Pick a grade band by school name hints, fall back to deterministic.
  function gradeBand(rand, name) {
    const n = name.toLowerCase();
    if (n.includes('elementary')) return 'K–5';
    if (n.includes('middle'))     return '6–8';
    if (n.includes('high'))       return '9–12';
    if (n.includes('k-8') || n.includes('k–8')) return 'K–8';
    if (n.includes('charter'))    return 'K–12';
    if (n.includes('academy'))    return pick(rand, ['K–5','6–8','K–8']);
    return pick(rand, ['K–5','6–8','9–12','K–8']);
  }
  function studentsFor(rand, band) {
    if (band === 'K–5')   return int(rand, 280, 720);
    if (band === '6–8')   return int(rand, 450, 1100);
    if (band === '9–12')  return int(rand, 900, 2400);
    if (band === 'K–8')   return int(rand, 380, 780);
    return int(rand, 320, 900);
  }

  // ─── Contract / MSA info ──────────────────────────────────────────────────
  function contractFor(rand) {
    const startYear = pick(rand, [2022, 2023, 2023, 2024, 2024]);
    const termYears = pick(rand, [1, 2, 2, 3, 3]);
    const month = int(rand, 1, 12);
    const day = int(rand, 1, 28);
    const startDate = `${startYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const endDate = `${startYear + termYears}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return {
      status: 'active',
      msaSignedDate: startDate,
      termYears,
      renewalDate: endDate,
      poNumber: `PO-${startYear}-${int(rand, 1000, 9999)}`,
    };
  }

  // ─── Documents ────────────────────────────────────────────────────────────
  function documentsFor(rand) {
    const t = Date.now() - int(rand, 30, 540) * 86400000;
    return [
      { id: 'sd1', kind: 'pdf',  name: 'Signed MSA',           url: 'https://drive.google.com/file/d/example-msa', addedAt: t },
      { id: 'sd2', kind: 'pdf',  name: 'COI on file',          url: 'https://drive.google.com/file/d/example-coi', addedAt: t + 86400000 },
      { id: 'sd3', kind: 'gdoc', name: 'Service scope letter', url: 'https://docs.google.com/document/d/example-scope', addedAt: t + 172800000 },
    ];
  }

  // ─── Build a map of which contractors cover which schools ─────────────────
  // (Derived from contractor assignments built in data-contractors.js)
  const coverageBySchool = {};
  for (const c of CONTRACTORS) {
    if (!c.assignments) continue;
    for (const a of c.assignments) {
      if (a.status !== 'active' || !a.schoolId) continue;
      if (!coverageBySchool[a.schoolId]) coverageBySchool[a.schoolId] = [];
      coverageBySchool[a.schoolId].push({
        contractorId: c.id,
        name: c.name,
        spec: c.spec,
        direct: a.direct || 0,
        indirect: a.indirect || 0,
        hoursPerWeek: a.hoursPerWeek || ((a.direct || 0) + (a.indirect || 0)),
        startDate: a.startDate,
      });
    }
  }

  // ─── Public: enrich a school record ───────────────────────────────────────
  function enrich(s) {
    if (s.__enriched) return s;
    const rand = rng(s.id + s.name);
    const band = gradeBand(rand, s.name);
    const district = DISTRICTS.find((d) => d.id === s.district);
    const districtName = district ? district.name : 'Independent';
    const districtSlug = districtName;

    const principalName = makeName(rand);
    const spedName = makeName(rand);
    const addr = addressOf(rand, s.state);

    return {
      ...s,
      districtName,
      gradeBand: band,
      students: studentsFor(rand, band),
      address: `${addr.street}, ${addr.city}, ${s.state} ${addr.zip}`,
      city: addr.city,
      mainPhone: phoneOf(rand, s.state),
      contacts: [
        { role: 'Principal',         name: principalName, email: emailOf(principalName, districtSlug), phone: phoneOf(rand, s.state) },
        { role: 'SPED coordinator',  name: spedName,      email: emailOf(spedName, districtSlug),      phone: phoneOf(rand, s.state) },
      ],
      contract: contractFor(rand),
      documents: documentsFor(rand),
      contractors: coverageBySchool[s.id] || [],
      __enriched: true,
    };
  }

  for (let i = 0; i < SCHOOLS.length; i++) SCHOOLS[i] = enrich(SCHOOLS[i]);

  // ─── Add district summaries (computed on the fly when needed) ────────────
  window.getDistrict = (id) => {
    const d = DISTRICTS.find((x) => x.id === id);
    if (!d) return null;
    const schools = SCHOOLS.filter((s) => s.district === id);
    return { ...d, schoolList: schools, schoolCount: schools.length };
  };
  window.getSchool = (id) => SCHOOLS.find((s) => s.id === id);
})();
