// pdf-parse.js — best-effort extraction of renewal data (expires_on, state,
// license type, license number) from an uploaded PDF.
//
// Uses pdf.js, lazy-loaded from unpkg on first call. Entirely client-side; no
// API keys, no backend. Heuristic-grade — works well on text-based PDFs from
// state boards/insurers, will whiff on scans (those need OCR).
//
// Public API:
//   await window.parsePdfForRenewal(file)
//   → { expiresOn, state, licenseNumber, label, confidence, raw }
//   confidence ∈ [0, 1] — higher = more fields matched + cleaner signals.
//   All fields may be null if not found. `raw` is the extracted text for
//   debugging; do not show it to the user.

(function () {
  const PDFJS_URL        = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js';
  const PDFJS_WORKER_URL = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

  let loadingPromise = null;
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (loadingPromise) return loadingPromise;
    loadingPromise = new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = PDFJS_URL;
      tag.async = true;
      tag.onload = () => {
        if (!window.pdfjsLib) return reject(new Error('pdf.js failed to expose pdfjsLib'));
        try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL; }
        catch (e) { console.warn('pdf.js worker config failed', e); }
        resolve(window.pdfjsLib);
      };
      tag.onerror = () => reject(new Error('Failed to load pdf.js'));
      document.head.appendChild(tag);
    });
    return loadingPromise;
  }

  async function extractText(file) {
    const pdfjs = await loadPdfJs();
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => it.str).join(' ') + '\n';
    }
    return text;
  }

  // ─── Heuristics ───────────────────────────────────────────────────────────

  // Date matching covers the formats we actually see on licenses/certificates:
  //   "Expires: 12/31/2026", "Expiration Date 12-31-26",
  //   "Valid through 2026-12-31", "Effective until December 31, 2026",
  //   plus bare "12/31/2026" near a known label.
  function findExpirationDate(text) {
    const t = text.replace(/\s+/g, ' ');
    const labels = [
      /(?:expir(?:es|ation)\s+(?:date|on)?|valid\s+(?:through|until|to)|good\s+(?:through|until)|renewal\s+date|effective\s+through)[\s:.\-]+([^\n]{0,40})/gi,
      /(?:through|until|to)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|[A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/g,
    ];
    const candidates = [];
    for (const re of labels) {
      let m;
      while ((m = re.exec(t)) !== null) {
        const after = m[1] || '';
        const parsed = parseDate(after);
        if (parsed) candidates.push({ iso: parsed, score: 3 });
      }
    }
    // Also catch standalone dates near the keyword "expir" (within 60 chars).
    const expirIdx = t.toLowerCase().indexOf('expir');
    if (expirIdx >= 0) {
      const window = t.slice(Math.max(0, expirIdx - 5), expirIdx + 80);
      const bare = findFirstDate(window);
      if (bare) candidates.push({ iso: bare, score: 2 });
    }
    if (!candidates.length) {
      // Final fallback: pick the latest plausible date in the doc.
      const all = findAllDates(t);
      if (all.length) {
        const latest = all.sort().reverse()[0];
        candidates.push({ iso: latest, score: 1 });
      }
    }
    if (!candidates.length) return null;
    // Best-by-score; ties broken by latest date (assuming farther-out date is
    // the expiration, not the issue date).
    candidates.sort((a, b) => b.score - a.score || b.iso.localeCompare(a.iso));
    return candidates[0].iso;
  }

  // Parse a single date string into ISO YYYY-MM-DD. Returns null if it can't.
  function parseDate(s) {
    if (!s) return null;
    s = s.trim();
    // Month name "December 31, 2026" or "Dec 31, 2026"
    const m1 = s.match(/([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (m1) {
      const month = monthIndex(m1[1]);
      if (month >= 0) return iso(Number(m1[3]), month + 1, Number(m1[2]));
    }
    // ISO 2026-12-31
    const m2 = s.match(/(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})/);
    if (m2) return iso(Number(m2[1]), Number(m2[2]), Number(m2[3]));
    // US 12/31/2026 or 12-31-26
    const m3 = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m3) {
      let y = Number(m3[3]);
      if (y < 100) y += y > 70 ? 1900 : 2000;
      return iso(y, Number(m3[1]), Number(m3[2]));
    }
    return null;
  }
  function findFirstDate(s) {
    const m1 = s.match(/(\d{4}[\-\/]\d{1,2}[\-\/]\d{1,2})/);
    if (m1) return parseDate(m1[1]);
    const m2 = s.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
    if (m2) return parseDate(m2[1]);
    const m3 = s.match(/([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/);
    if (m3) return parseDate(m3[1]);
    return null;
  }
  function findAllDates(s) {
    const out = [];
    const re = /(\d{4}[\-\/]\d{1,2}[\-\/]\d{1,2})|(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/g;
    let m;
    while ((m = re.exec(s)) !== null) {
      const d = parseDate(m[0]);
      if (d) out.push(d);
    }
    return out;
  }
  function monthIndex(name) {
    const ms = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const short = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const n = name.toLowerCase();
    let idx = ms.indexOf(n);
    if (idx >= 0) return idx;
    idx = short.indexOf(n);
    return idx;
  }
  function iso(y, m, d) {
    if (!y || !m || !d) return null;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // State codes — match 2-letter postal codes near "state" or "license" or
  // "issued in", or just the most-common state mentioned.
  const STATE_CODES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'];
  function findState(text) {
    const t = ' ' + text + ' ';
    // Prefer state immediately after a label.
    const labeled = t.match(/(?:state(?:\s+of)?|jurisdiction|licensed\s+in|issued\s+in)[\s:]+([A-Z][A-Za-z .]{2,30})/i);
    if (labeled) {
      const after = labeled[1].toUpperCase();
      for (const code of STATE_CODES) {
        if (after.startsWith(code + ' ') || after.startsWith(code + ',') || after === code) return code;
      }
      const named = findFullName(after);
      if (named) return named;
    }
    // Count frequency of state codes as a fallback.
    const counts = {};
    for (const code of STATE_CODES) {
      const re = new RegExp(`\\b${code}\\b`, 'g');
      const matches = t.match(re);
      if (matches) counts[code] = matches.length;
    }
    const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    return sorted[0] || null;
  }
  const STATE_NAMES = {
    'ALABAMA':'AL','ALASKA':'AK','ARIZONA':'AZ','ARKANSAS':'AR','CALIFORNIA':'CA','COLORADO':'CO','CONNECTICUT':'CT','DELAWARE':'DE',
    'FLORIDA':'FL','GEORGIA':'GA','HAWAII':'HI','IDAHO':'ID','ILLINOIS':'IL','INDIANA':'IN','IOWA':'IA','KANSAS':'KS','KENTUCKY':'KY',
    'LOUISIANA':'LA','MAINE':'ME','MARYLAND':'MD','MASSACHUSETTS':'MA','MICHIGAN':'MI','MINNESOTA':'MN','MISSISSIPPI':'MS','MISSOURI':'MO',
    'MONTANA':'MT','NEBRASKA':'NE','NEVADA':'NV','NEW HAMPSHIRE':'NH','NEW JERSEY':'NJ','NEW MEXICO':'NM','NEW YORK':'NY','NORTH CAROLINA':'NC',
    'NORTH DAKOTA':'ND','OHIO':'OH','OKLAHOMA':'OK','OREGON':'OR','PENNSYLVANIA':'PA','RHODE ISLAND':'RI','SOUTH CAROLINA':'SC','SOUTH DAKOTA':'SD',
    'TENNESSEE':'TN','TEXAS':'TX','UTAH':'UT','VERMONT':'VT','VIRGINIA':'VA','WASHINGTON':'WA','WEST VIRGINIA':'WV','WISCONSIN':'WI','WYOMING':'WY',
    'DISTRICT OF COLUMBIA':'DC',
  };
  function findFullName(upper) {
    for (const name of Object.keys(STATE_NAMES)) {
      if (upper.includes(name)) return STATE_NAMES[name];
    }
    return null;
  }

  // License-type / credential keywords. Order matters: more-specific first.
  const LICENSE_PATTERNS = [
    { re: /\bbcba[\-\s]?d\b/i,  label: 'BCBA-D' },
    { re: /\bbcba\b/i,          label: 'BCBA' },
    { re: /\bbcaba\b/i,         label: 'BCaBA' },
    { re: /\brbt\b/i,           label: 'RBT' },
    { re: /\bccc[\-\s]?slp\b/i, label: 'CCC-SLP' },
    { re: /\bslp\b/i,           label: 'SLP' },
    { re: /\bccc[\-\s]?a\b/i,   label: 'CCC-A' },
    { re: /\botr\/l\b/i,        label: 'OTR/L' },
    { re: /\botr\b/i,           label: 'OTR' },
    { re: /\bcota\b/i,          label: 'COTA' },
    { re: /\bpt\b/i,            label: 'PT' },
    { re: /\bpta\b/i,           label: 'PTA' },
    { re: /\blcsw\b/i,          label: 'LCSW' },
    { re: /\blmsw\b/i,          label: 'LMSW' },
    { re: /\blmft\b/i,          label: 'LMFT' },
    { re: /\blcmhc\b/i,         label: 'LCMHC' },
    { re: /\blmhc\b/i,          label: 'LMHC' },
    { re: /\blpc\b/i,           label: 'LPC' },
    { re: /\bnp\b/i,            label: 'NP' },
    // Background check / insurance fall-throughs
    { re: /\bgeneral liability\b/i,        label: 'General Liability' },
    { re: /\bprofessional liability\b/i,   label: 'Professional Liability' },
    { re: /\bmalpractice\b/i,              label: 'Malpractice' },
    { re: /\bbackground (?:check|investigation)\b/i, label: 'Background check' },
    { re: /\bfingerprint(?:ing)?\b/i,      label: 'Fingerprint clearance' },
  ];
  function findLabel(text) {
    for (const p of LICENSE_PATTERNS) {
      if (p.re.test(text)) return p.label;
    }
    return null;
  }

  // License number — typical formats: "License #ABC-123456", "License No. 1234567"
  function findLicenseNumber(text) {
    const m = text.match(/(?:license|registration|policy|certificate)\s*(?:#|no\.?|number)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/]{4,20})/i);
    if (m) return m[1].toUpperCase();
    return null;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  async function parsePdfForRenewal(file) {
    if (!file || !/\.pdf$/i.test(file.name || '')) return null;
    let text;
    try {
      text = await extractText(file);
    } catch (e) {
      console.warn('pdf parse failed', e);
      return null;
    }
    if (!text || !text.trim()) return null;

    const expiresOn     = findExpirationDate(text);
    const state         = findState(text);
    const label         = findLabel(text);
    const licenseNumber = findLicenseNumber(text);

    // Confidence: 0.25 per matched field, capped at 1.
    const hits = [expiresOn, state, label, licenseNumber].filter(Boolean).length;
    const confidence = hits / 4;

    return { expiresOn, state, label, licenseNumber, confidence, raw: text };
  }

  window.parsePdfForRenewal = parsePdfForRenewal;
})();
