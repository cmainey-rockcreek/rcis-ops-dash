// TodoEditor — create/edit modal for a single todo.
// Receives a `todo` object (can be a new draft with empty title) and palette.
// onSave(patch), onDelete(), onClose() callbacks.

(function () {
  const { OwnerAvatar, Icon, teamMember } = window;

  // ─── Attachment helpers ───────────────────────────────────────────────────
  // Detect what kind of resource a pasted URL points at so we can label and
  // color it consistently. Falls back to "Link".
  function detectAttachmentKind(url, name) {
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
  const KIND_META = {
    gsheet:    { abbr: 'SHEET',  full: 'Google Sheet',     color: '#0F9D58' },
    gdoc:      { abbr: 'DOC',    full: 'Google Doc',       color: '#4285F4' },
    gslides:   { abbr: 'SLIDES', full: 'Google Slides',    color: '#F4B400' },
    gdrive:    { abbr: 'DRIVE',  full: 'Google Drive',     color: '#4285F4' },
    dropbox:   { abbr: 'DBX',    full: 'Dropbox',          color: '#0061FF' },
    onedrive:  { abbr: '1DRIVE', full: 'OneDrive',         color: '#0078D4' },
    sharepoint:{ abbr: 'SP',     full: 'SharePoint',       color: '#03787C' },
    pdf:       { abbr: 'PDF',    full: 'PDF',              color: '#C04E40' },
    doc:       { abbr: 'DOC',    full: 'Document',         color: '#4285F4' },
    xls:       { abbr: 'XLS',    full: 'Spreadsheet',      color: '#0F9D58' },
    csv:       { abbr: 'CSV',    full: 'CSV',              color: '#0F9D58' },
    ppt:       { abbr: 'PPT',    full: 'Presentation',     color: '#F4B400' },
    link:      { abbr: 'LINK',   full: 'Link',             color: '#5A6478' },
  };
  function defaultAttachmentName(url) {
    try {
      const u = new URL(url);
      const last = u.pathname.split('/').filter(Boolean).pop();
      if (last && last.includes('.')) return decodeURIComponent(last);
      return u.hostname.replace(/^www\./, '');
    } catch (e) {
      return url.slice(0, 60);
    }
  }
  function attachmentId() {
    return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }

  // Public for the dashboard card to render small kind-badges.
  window.attachmentKindMeta = (kind) => KIND_META[kind] || KIND_META.link;

  function TodoEditor({ todo, pal, onSave, onDelete, onClose, isNew }) {
    const team = window.useTeam ? window.useTeam() : window.RCIS_DATA.TEAM;
    // Old todos in localStorage may pre-date notes/attachments — default them.
    const [draft, setDraft] = React.useState({
      notes: '',
      attachments: [],
      ...todo,
    });
    const [linkOpen, setLinkOpen] = React.useState(false);
    const [linkQuery, setLinkQuery] = React.useState('');
    const titleRef = React.useRef(null);

    React.useEffect(() => {
      // Autofocus title on open.
      if (titleRef.current) titleRef.current.focus();
    }, []);

    React.useEffect(() => {
      // Esc closes (without saving).
      const onKey = (e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    });

    const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
    const toggleOwner = (id) => {
      const has = draft.owners.includes(id);
      set({ owners: has ? draft.owners.filter((x) => x !== id) : [...draft.owners, id] });
    };

    const handleSave = () => {
      if (!draft.title.trim()) {
        if (titleRef.current) titleRef.current.focus();
        return;
      }
      onSave({ ...draft, title: draft.title.trim() });
    };

    const linkOptions = React.useMemo(() => {
      const out = [];
      const q = linkQuery.trim().toLowerCase();
      const match = (s) => !q || s.toLowerCase().includes(q);
      window.RCIS_DATA.CONTRACTORS.forEach((c) => {
        if (match(c.name) || match(c.spec)) out.push({ type: 'contractor', id: c.id, name: c.name, sub: c.spec });
      });
      window.RCIS_DATA.SCHOOLS.forEach((s) => {
        if (match(s.name) || match(s.state)) out.push({ type: 'school', id: s.id, name: s.name, sub: s.state });
      });
      window.RCIS_DATA.DISTRICTS.forEach((d) => {
        if (match(d.name) || match(d.state)) out.push({ type: 'district', id: d.id, name: d.name, sub: d.state });
      });
      return out.slice(0, 20);
    }, [linkQuery]);

    const styles = {
      backdrop: {
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(16,18,22,.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 40,
      },
      modal: {
        background: pal.card,
        color: pal.text,
        borderRadius: 14,
        width: '100%', maxWidth: 540,
        maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 30px 80px rgba(0,0,0,.35), 0 0 0 1px ' + pal.border,
        overflow: 'hidden',
        fontFamily: '"Public Sans", system-ui, sans-serif',
      },
      header: {
        padding: '14px 20px',
        borderBottom: `1px solid ${pal.border}`,
        display: 'flex', alignItems: 'center', gap: 10,
      },
      body: {
        padding: '16px 20px',
        display: 'flex', flexDirection: 'column', gap: 14,
        overflowY: 'auto',
      },
      label: {
        fontSize: 11, fontWeight: 600, letterSpacing: 0.4,
        textTransform: 'uppercase',
        color: pal.textFaint,
        marginBottom: 5,
      },
      input: {
        width: '100%', padding: '8px 11px',
        fontSize: 14, color: pal.text,
        background: pal.cardAlt,
        border: `1px solid ${pal.border}`,
        borderRadius: 7,
        outline: 'none',
        fontFamily: 'inherit',
        lineHeight: 1.4,
      },
      titleInput: {
        width: '100%', padding: '6px 0',
        fontSize: 17, fontWeight: 600, letterSpacing: -0.2,
        color: pal.text,
        background: 'transparent',
        border: 'none', outline: 'none',
        fontFamily: 'inherit',
      },
      row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
      pillRow: { display: 'flex', gap: 6 },
      pill: (on, color) => ({
        flex: 1,
        padding: '7px 10px',
        fontSize: 12.5, fontWeight: 600,
        textAlign: 'center',
        borderRadius: 7,
        border: `1px solid ${on ? color : pal.border}`,
        background: on ? color + '18' : 'transparent',
        color: on ? color : pal.textSoft,
        cursor: 'pointer',
        transition: 'background .12s, border-color .12s, color .12s',
        userSelect: 'none',
      }),
      ownerBtn: (on) => ({
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 10px 5px 5px',
        borderRadius: 999,
        background: on ? pal.accentSoft : 'transparent',
        border: `1px solid ${on ? pal.accent : pal.border}`,
        color: on ? pal.text : pal.textSoft,
        fontSize: 12.5, fontWeight: 500,
        cursor: 'pointer',
      }),
      footer: {
        padding: '12px 20px',
        borderTop: `1px solid ${pal.border}`,
        display: 'flex', alignItems: 'center', gap: 8,
      },
      btnPrimary: {
        padding: '8px 16px',
        background: pal.accent, color: '#fff',
        border: 'none', borderRadius: 7,
        fontSize: 13, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit',
      },
      btnSecondary: {
        padding: '8px 14px',
        background: 'transparent', color: pal.textSoft,
        border: `1px solid ${pal.border}`, borderRadius: 7,
        fontSize: 13, fontWeight: 500,
        cursor: 'pointer', fontFamily: 'inherit',
      },
      btnDanger: {
        padding: '8px 14px',
        background: 'transparent', color: pal.warn,
        border: `1px solid ${pal.border}`, borderRadius: 7,
        fontSize: 13, fontWeight: 500,
        cursor: 'pointer', fontFamily: 'inherit',
      },
    };

    const PRIO_COLORS = { high: '#D97757', medium: '#C98A2C', low: '#7A8290' };
    const COL_NAMES = { todo: 'To do', doing: 'Doing', done: 'Done' };

    return (
      <div style={styles.backdrop} onClick={onClose}>
        <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div style={styles.header}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
              color: pal.textFaint,
            }}>{isNew ? 'New task' : 'Edit task'}</div>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: pal.textFaint }}>
              {!isNew && draft.updatedAt && `Last edited ${timeAgo(draft.updatedAt)}`}
            </span>
            <button onClick={onClose} style={{
              border: 'none', background: 'transparent', color: pal.textSoft,
              fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: '2px 4px', borderRadius: 4,
            }}>×</button>
          </div>

          <div style={styles.body}>
            <input
              ref={titleRef}
              style={styles.titleInput}
              placeholder="What needs to happen?"
              value={draft.title}
              onChange={(e) => set({ title: e.target.value })}
            />

            {/* Status + Priority */}
            <div style={styles.row}>
              <div>
                <div style={styles.label}>Status</div>
                <div style={styles.pillRow}>
                  {['todo', 'doing', 'done'].map((c) => (
                    <div key={c} style={styles.pill(draft.column === c, c === 'done' ? '#3E8A57' : c === 'doing' ? pal.accent : pal.textSoft)}
                         onClick={() => set({ column: c })}>{COL_NAMES[c]}</div>
                  ))}
                </div>
              </div>
              <div>
                <div style={styles.label}>Priority</div>
                <div style={styles.pillRow}>
                  {['high', 'medium', 'low'].map((p) => (
                    <div key={p} style={styles.pill(draft.priority === p, PRIO_COLORS[p])}
                         onClick={() => set({ priority: p })}>
                      {p[0].toUpperCase() + p.slice(1)}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Label + Due */}
            <div style={styles.row}>
              <div>
                <div style={styles.label}>Category</div>
                <select style={styles.input} value={draft.label}
                        onChange={(e) => set({ label: e.target.value })}>
                  {window.RCIS_DATA.LABELS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={styles.label}>Due date</div>
                <input type="date" style={styles.input}
                       value={draft.due || ''}
                       onChange={(e) => set({ due: e.target.value || null })} />
              </div>
            </div>

            {/* Owners */}
            <div>
              <div style={styles.label}>Owners</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {team.map((m) => {
                  const on = draft.owners.includes(m.id);
                  return (
                    <div key={m.id} style={styles.ownerBtn(on)} onClick={() => toggleOwner(m.id)}>
                      <OwnerAvatar id={m.id} size={22} />
                      <span>{m.name.split(' ')[0]}</span>
                      {on && <span style={{ color: pal.accent, fontSize: 14, lineHeight: 1, marginLeft: 2 }}>✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Linked to */}
            <div>
              <div style={styles.label}>Linked to <span style={{ textTransform: 'none', fontWeight: 500, color: pal.textFaint }}>· optional</span></div>
              {draft.linkedTo && !linkOpen ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 11px',
                  background: pal.cardAlt,
                  border: `1px solid ${pal.border}`,
                  borderRadius: 7,
                  fontSize: 13,
                }}>
                  <LinkTypeBadge type={draft.linkedTo.type} pal={pal} />
                  <span style={{ color: pal.text, fontWeight: 500, flex: 1 }}>{draft.linkedTo.name}</span>
                  <button onClick={() => { setLinkOpen(true); setLinkQuery(''); }}
                          style={{ ...styles.btnSecondary, padding: '4px 9px', fontSize: 11.5 }}>Change</button>
                  <button onClick={() => set({ linkedTo: null })}
                          style={{ ...styles.btnSecondary, padding: '4px 9px', fontSize: 11.5 }}>Remove</button>
                </div>
              ) : (
                <div>
                  <input
                    style={styles.input}
                    placeholder="Search a contractor, school, or district…"
                    value={linkQuery}
                    onChange={(e) => { setLinkQuery(e.target.value); setLinkOpen(true); }}
                    onFocus={() => setLinkOpen(true)}
                  />
                  {linkOpen && (
                    <div style={{
                      marginTop: 6,
                      maxHeight: 200, overflowY: 'auto',
                      background: pal.cardAlt,
                      border: `1px solid ${pal.border}`,
                      borderRadius: 7,
                    }}>
                      {linkOptions.length === 0 && (
                        <div style={{ padding: '10px 12px', fontSize: 12.5, color: pal.textFaint }}>No matches.</div>
                      )}
                      {linkOptions.map((opt) => (
                        <div key={opt.type + opt.id}
                             onClick={() => { set({ linkedTo: { type: opt.type, id: opt.id, name: opt.name } }); setLinkOpen(false); setLinkQuery(''); }}
                             style={{
                               display: 'flex', alignItems: 'center', gap: 9,
                               padding: '7px 11px',
                               cursor: 'pointer', fontSize: 13,
                               borderBottom: `1px solid ${pal.borderSoft}`,
                             }}
                             onMouseEnter={(e) => e.currentTarget.style.background = pal.chipBg}
                             onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                          <LinkTypeBadge type={opt.type} pal={pal} />
                          <span style={{ color: pal.text, fontWeight: 500, flex: 1 }}>{opt.name}</span>
                          <span style={{ color: pal.textFaint, fontSize: 11 }}>{opt.sub}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <div style={styles.label}>Notes</div>
              <textarea
                value={draft.notes}
                onChange={(e) => set({ notes: e.target.value })}
                placeholder="Anything else worth writing down — context, decisions, who said what…"
                style={{
                  ...styles.input,
                  minHeight: 88,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  lineHeight: 1.5,
                  padding: '9px 11px',
                }}
              />
            </div>

            {/* Attachments */}
            <Attachments
              attachments={draft.attachments}
              onChange={(next) => set({ attachments: next })}
              pal={pal}
            />
          </div>

          <div style={styles.footer}>
            {!isNew && (
              <button style={styles.btnDanger}
                      onClick={() => { if (confirm('Delete this todo?')) onDelete(); }}>
                Delete
              </button>
            )}
            <span style={{ flex: 1 }} />
            <button style={styles.btnSecondary} onClick={onClose}>Cancel</button>
            <button style={styles.btnPrimary} onClick={handleSave}>
              {isNew ? 'Create' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Attachments sub-component ────────────────────────────────────────────
  function Attachments({ attachments, onChange, pal }) {
    const [adding, setAdding] = React.useState(false);
    const [url, setUrl] = React.useState('');
    const [name, setName] = React.useState('');
    const urlRef = React.useRef(null);

    const reset = () => { setAdding(false); setUrl(''); setName(''); };
    const commit = () => {
      const trimmed = url.trim();
      if (!trimmed) return;
      const finalName = name.trim() || defaultAttachmentName(trimmed);
      const kind = detectAttachmentKind(trimmed, finalName);
      onChange([...attachments, {
        id: attachmentId(),
        kind, url: trimmed, name: finalName,
        addedAt: Date.now(),
      }]);
      reset();
    };
    const remove = (id) => onChange(attachments.filter((a) => a.id !== id));

    React.useEffect(() => {
      if (adding && urlRef.current) urlRef.current.focus();
    }, [adding]);

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: 0.4,
            textTransform: 'uppercase', color: pal.textFaint, marginBottom: 5,
          }}>Attachments
            <span style={{ textTransform: 'none', fontWeight: 500, color: pal.textFaint, marginLeft: 6 }}>
              · paste a Google Drive / Dropbox / any URL
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {attachments.map((a) => {
            const meta = KIND_META[a.kind] || KIND_META.link;
            return (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 10px',
                background: pal.cardAlt,
                border: `1px solid ${pal.border}`,
                borderRadius: 7,
              }}>
                <KindBadge meta={meta} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <a href={a.url} target="_blank" rel="noreferrer"
                     onClick={(e) => e.stopPropagation()}
                     style={{
                       fontSize: 12.5, color: pal.text, fontWeight: 500,
                       textDecoration: 'none',
                       display: 'block',
                       whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                     }}
                     onMouseEnter={(e) => e.currentTarget.style.color = pal.accent}
                     onMouseLeave={(e) => e.currentTarget.style.color = pal.text}>
                    {a.name}
                  </a>
                  <div style={{ fontSize: 10.5, color: pal.textFaint, marginTop: 1,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {meta.full} · {hostOf(a.url)}
                  </div>
                </div>
                <button onClick={() => remove(a.id)}
                  title="Remove attachment"
                  style={{
                    border: 'none', background: 'transparent',
                    color: pal.textFaint, fontSize: 16, lineHeight: 1,
                    cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = pal.warn; e.currentTarget.style.background = pal.warnSoft; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = pal.textFaint; e.currentTarget.style.background = 'transparent'; }}
                >×</button>
              </div>
            );
          })}

          {adding ? (
            <div style={{
              padding: '10px 10px 10px 10px',
              background: pal.cardAlt,
              border: `1px dashed ${pal.border}`,
              borderRadius: 7,
              display: 'flex', flexDirection: 'column', gap: 7,
            }}>
              <input
                ref={urlRef}
                placeholder="Paste URL — Google Doc, Sheet, Drive, Dropbox, anything…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') reset(); }}
                style={{
                  width: '100%', padding: '7px 10px',
                  fontSize: 12.5, color: pal.text,
                  background: pal.card,
                  border: `1px solid ${pal.border}`, borderRadius: 6,
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: 7 }}>
                <input
                  placeholder={url ? defaultAttachmentName(url) : 'Display name (optional)'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') reset(); }}
                  style={{
                    flex: 1, padding: '7px 10px',
                    fontSize: 12.5, color: pal.text,
                    background: pal.card,
                    border: `1px solid ${pal.border}`, borderRadius: 6,
                    outline: 'none', fontFamily: 'inherit',
                  }}
                />
                <button onClick={reset}
                  style={{
                    padding: '0 12px',
                    background: 'transparent', color: pal.textSoft,
                    border: `1px solid ${pal.border}`, borderRadius: 6,
                    fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                  }}>Cancel</button>
                <button onClick={commit} disabled={!url.trim()}
                  style={{
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
            <button onClick={() => setAdding(true)}
              style={{
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
        <div style={{ fontSize: 10.5, color: pal.textFaint, marginTop: 6, lineHeight: 1.4 }}>
          Uploading files from your computer needs backend storage — coming when we wire up Supabase.
          For now, drop your file in Google Drive / Dropbox and paste the share link.
        </div>
      </div>
    );
  }

  function KindBadge({ meta }) {
    return (
      <span style={{
        flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 44, padding: '3px 7px',
        background: meta.color + '20', color: meta.color,
        fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6,
        borderRadius: 4,
        fontFamily: 'ui-monospace, monospace',
      }}>{meta.abbr}</span>
    );
  }
  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch (e) { return ''; }
  }

  function LinkTypeBadge({ type, pal }) {
    const map = {
      contractor: { txt: 'CONT', c: '#1FA39A' },
      school:     { txt: 'SCH',  c: '#E76B5D' },
      district:   { txt: 'DIST', c: '#1B2956' },
    };
    const m = map[type] || map.school;
    return (
      <span style={{
        fontSize: 9, fontWeight: 800, letterSpacing: 0.6,
        padding: '3px 6px', borderRadius: 4,
        background: m.c + '20', color: m.c,
        fontFamily: 'ui-monospace, monospace',
      }}>{m.txt}</span>
    );
  }

  function timeAgo(t) {
    const sec = Math.floor((Date.now() - t) / 1000);
    if (sec < 60) return 'just now';
    if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
    if (sec < 86400) return Math.floor(sec / 3600) + 'h ago';
    return Math.floor(sec / 86400) + 'd ago';
  }

  window.TodoEditor = TodoEditor;
  window.LinkTypeBadge = LinkTypeBadge;
})();
