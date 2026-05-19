// DocumentsSection — shared card used on district + school detail pages.
// Per-entity localStorage store so docs persist. Paste any URL — type is
// auto-detected from the URL like todo attachments.

(function () {
  const { Icon } = window;

  function detectKind(url, name) {
    const u = (url || '').toLowerCase();
    const n = (name || '').toLowerCase();
    if (u.includes('docs.google.com/spreadsheets')) return 'gsheet';
    if (u.includes('docs.google.com/document'))     return 'gdoc';
    if (u.includes('docs.google.com/presentation')) return 'gslides';
    if (u.includes('drive.google.com'))             return 'gdrive';
    if (u.includes('dropbox.com'))                  return 'dropbox';
    if (u.includes('onedrive.live.com') || u.includes('1drv.ms')) return 'onedrive';
    if (u.includes('sharepoint.com'))               return 'sharepoint';
    if (n.endsWith('.pdf')  || u.endsWith('.pdf'))  return 'pdf';
    if (n.endsWith('.csv')  || u.endsWith('.csv'))  return 'csv';
    if (n.endsWith('.doc')  || n.endsWith('.docx') || u.endsWith('.docx')) return 'doc';
    if (n.endsWith('.xls')  || n.endsWith('.xlsx') || u.endsWith('.xlsx')) return 'xls';
    if (n.endsWith('.ppt')  || n.endsWith('.pptx')) return 'ppt';
    return 'link';
  }
  function defaultName(url) {
    try {
      const u = new URL(url);
      const last = u.pathname.split('/').filter(Boolean).pop();
      if (last && last.includes('.')) return decodeURIComponent(last);
      return u.hostname.replace(/^www\./, '');
    } catch (e) { return url.slice(0, 60); }
  }
  function uid() {
    return 'doc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }
  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch (e) { return ''; }
  }

  function loadSeed(scope, scopeId) {
    // For schools we have a pre-seeded list in the data; bring it over the
    // first time so existing seed docs still appear.
    if (scope === 'school') {
      const s = window.RCIS_DATA.SCHOOLS.find((x) => x.id === scopeId);
      return s && Array.isArray(s.documents) ? s.documents : [];
    }
    return [];
  }

  function useDocs(scope, scopeId) {
    const KEY = `rcis.docs.${scope}.${scopeId}`;
    const [docs, setDocs] = React.useState(() => {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) {}
      return loadSeed(scope, scopeId);
    });
    const save = (next) => {
      setDocs(next);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) {}
    };
    return [docs, save];
  }

  function DocumentsSection({ pal, scope, scopeId, title }) {
    const docs = window.useDocuments(scope, scopeId);
    const [adding, setAdding] = React.useState(false);
    const [url, setUrl] = React.useState('');
    const [name, setName] = React.useState('');
    const urlRef = React.useRef(null);
    const meta = window.attachmentKindMeta;

    React.useEffect(() => {
      if (adding && urlRef.current) urlRef.current.focus();
    }, [adding]);

    const reset = () => { setAdding(false); setUrl(''); setName(''); };
    const commit = async () => {
      const trimmed = url.trim();
      if (!trimmed) return;
      const finalName = name.trim() || defaultName(trimmed);
      const kind = detectKind(trimmed, finalName);
      await window.DocumentsStore.add({ scope, scopeId, kind, url: trimmed, name: finalName });
      reset();
    };
    const remove = (id) => window.DocumentsStore.remove(id);

    return (
      <div style={{
        background: pal.card, border: `1px solid ${pal.border}`,
        borderRadius: 10, padding: 16,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: pal.text }}>{title || 'Documents'}</h3>
          <span style={{
            fontSize: 11, fontWeight: 600, color: pal.textSoft,
            background: pal.chipBg, padding: '1px 7px', borderRadius: 10,
            fontVariantNumeric: 'tabular-nums',
          }}>{docs.length}</span>
        </div>

        {docs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {docs.map((d) => {
              const m = meta ? meta(d.kind) : { abbr: 'FILE', full: 'File', color: pal.textSoft };
              return (
                <div key={d.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 10px',
                  background: pal.cardAlt,
                  border: `1px solid ${pal.borderSoft}`, borderRadius: 7,
                }}>
                  <span style={{
                    flexShrink: 0,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: 42, padding: '3px 7px',
                    background: m.color + '20', color: m.color,
                    fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6,
                    borderRadius: 4, fontFamily: 'ui-monospace, monospace',
                  }}>{m.abbr}</span>
                  <a href={d.url} target="_blank" rel="noreferrer"
                     style={{
                       flex: 1, minWidth: 0,
                       textDecoration: 'none', color: 'inherit',
                     }}>
                    <div style={{ fontSize: 12.5, color: pal.text, fontWeight: 500,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                    <div style={{ fontSize: 10.5, color: pal.textFaint, marginTop: 1 }}>
                      {m.full}{hostOf(d.url) ? ` · ${hostOf(d.url)}` : ''}
                    </div>
                  </a>
                  <button onClick={() => remove(d.id)} title="Remove"
                    style={{
                      border: 'none', background: 'transparent',
                      color: pal.textFaint, fontSize: 16, lineHeight: 1,
                      cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = pal.warn; e.currentTarget.style.background = pal.warnSoft; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = pal.textFaint; e.currentTarget.style.background = 'transparent'; }}>×</button>
                </div>
              );
            })}
          </div>
        )}

        {adding ? (
          <div style={{
            padding: 10,
            background: pal.cardAlt,
            border: `1px dashed ${pal.border}`,
            borderRadius: 7,
            display: 'flex', flexDirection: 'column', gap: 7,
          }}>
            <input ref={urlRef} value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') reset(); }}
              placeholder="Paste URL — Google Doc, Sheet, Drive, Dropbox, anything…"
              style={{
                width: '100%', padding: '7px 10px',
                fontSize: 12.5, color: pal.text,
                background: pal.card,
                border: `1px solid ${pal.border}`, borderRadius: 6,
                outline: 'none', fontFamily: 'inherit',
              }} />
            <div style={{ display: 'flex', gap: 7 }}>
              <input value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') reset(); }}
                placeholder={url ? defaultName(url) : 'Display name (optional)'}
                style={{
                  flex: 1, padding: '7px 10px',
                  fontSize: 12.5, color: pal.text,
                  background: pal.card,
                  border: `1px solid ${pal.border}`, borderRadius: 6,
                  outline: 'none', fontFamily: 'inherit',
                }} />
              <button onClick={reset} style={{
                padding: '0 12px', background: 'transparent', color: pal.textSoft,
                border: `1px solid ${pal.border}`, borderRadius: 6,
                fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancel</button>
              <button onClick={commit} disabled={!url.trim()} style={{
                padding: '0 14px',
                background: url.trim() ? pal.accent : pal.chipBg,
                color: url.trim() ? '#fff' : pal.textFaint,
                border: 'none', borderRadius: 6,
                fontSize: 12, fontWeight: 600,
                cursor: url.trim() ? 'pointer' : 'default', fontFamily: 'inherit',
              }}>Add</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={{
            padding: '8px 12px',
            background: 'transparent',
            color: pal.textSoft,
            border: `1px dashed ${pal.border}`,
            borderRadius: 7,
            fontSize: 12.5, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = pal.accent; e.currentTarget.style.color = pal.accent; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = pal.border; e.currentTarget.style.color = pal.textSoft; }}>
            <Icon name="plus" size={12} stroke={2.4} /> Add link
          </button>
        )}
      </div>
    );
  }

  window.DocumentsSection = DocumentsSection;
})();
