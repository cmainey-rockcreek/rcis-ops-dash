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

  // ─── File upload helpers ──────────────────────────────────────────────────
  // Files go to a private Supabase Storage bucket. Stored attachments carry
  // a `storagePath` instead of a `url`; we generate signed URLs on demand
  // when the user clicks to view.
  const STORAGE_BUCKET = 'task-attachments';
  const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
  const ALLOWED_UPLOAD_EXTS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.csv', '.txt'];
  const UPLOAD_ACCEPT = ALLOWED_UPLOAD_EXTS.join(',');

  function formatBytes(n) {
    if (n == null) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function validateUpload(file) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return 'File is too large. Max size is 10 MB.';
    }
    const lower = file.name.toLowerCase();
    const extOk = ALLOWED_UPLOAD_EXTS.some((ext) => lower.endsWith(ext));
    if (!extOk) {
      return 'Unsupported file type. Allowed: PDF, Word, Excel, PowerPoint, CSV, TXT.';
    }
    return null;
  }

  async function uploadAttachmentFile(file) {
    if (!window.sb) throw new Error('Supabase client not ready.');
    const id = attachmentId();
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const storagePath = `${id}/${safeName}`;
    const { error } = await window.sb.storage.from(STORAGE_BUCKET).upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) throw error;
    const kind = detectAttachmentKind('', file.name);
    return {
      id,
      kind,
      name: file.name,
      storagePath,
      size: file.size,
      uploadedAt: Date.now(),
      source: 'upload',
    };
  }

  async function openUploadedAttachment(attachment) {
    if (!window.sb) return;
    const { data, error } = await window.sb.storage.from(STORAGE_BUCKET)
      .createSignedUrl(attachment.storagePath, 60);
    if (error || !data) {
      alert('Could not open file: ' + (error && error.message ? error.message : 'unknown error'));
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  // Best-effort cleanup. Failures are logged, not surfaced — the file may
  // already have been removed or never made it to the bucket.
  async function deleteAttachmentFile(attachment) {
    if (!attachment || !attachment.storagePath || !window.sb) return;
    const { error } = await window.sb.storage.from(STORAGE_BUCKET)
      .remove([attachment.storagePath]);
    if (error) console.warn('attachment cleanup failed', error);
  }

  window.deleteTaskAttachmentFiles = async (attachments) => {
    if (!attachments || !window.sb) return;
    const paths = attachments.filter((a) => a && a.storagePath).map((a) => a.storagePath);
    if (!paths.length) return;
    const { error } = await window.sb.storage.from(STORAGE_BUCKET).remove(paths);
    if (error) console.warn('task attachment cleanup failed', error);
  };

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
    const linkBoxRef = React.useRef(null);

    React.useEffect(() => {
      if (!linkOpen) return;
      const onMouseDown = (e) => {
        if (linkBoxRef.current && !linkBoxRef.current.contains(e.target)) {
          setLinkOpen(false);
        }
      };
      document.addEventListener('mousedown', onMouseDown);
      return () => document.removeEventListener('mousedown', onMouseDown);
    }, [linkOpen]);
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

    // Subscribe to contacts so renamed contacts appear in the picker live.
    const contactRows = window.useContacts ? window.useContacts() : [];
    const linkOptions = React.useMemo(() => {
      const out = [];
      const q = linkQuery.trim().toLowerCase();
      const match = (s) => !q || s.toLowerCase().includes(q);
      window.RCIS_DATA.CONTRACTORS.forEach((raw) => {
        const c = window.applyContractorOverride ? window.applyContractorOverride(raw) : raw;
        if (match(c.name) || match(c.spec)) out.push({ type: 'contractor', id: c.id, name: c.name, sub: c.spec });
      });
      contactRows.forEach((p) => {
        if (match(p.name) || match(p.role) || match(p.organization || '')) {
          out.push({ type: 'contact', id: p.id, name: p.name, sub: [p.role, p.organization].filter(Boolean).join(' · ') });
        }
      });
      window.RCIS_DATA.SCHOOLS.forEach((s) => {
        if (match(s.name) || match(s.state)) out.push({ type: 'school', id: s.id, name: s.name, sub: s.state });
      });
      window.RCIS_DATA.DISTRICTS.forEach((d) => {
        if (match(d.name) || match(d.state)) out.push({ type: 'district', id: d.id, name: d.name, sub: d.state });
      });
      return out.slice(0, 20);
    }, [linkQuery, contactRows]);

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
        minHeight: 34,
        padding: '6px 10px',
        fontSize: 12.5, fontWeight: 600,
        lineHeight: 1.2,
        textAlign: 'center',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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
    const COL_NAMES = { todo: 'To Do', doing: 'Doing', attention: 'Attention', done: 'Done' };
    const COL_TINT = (c, pal) => c === 'done' ? '#3E8A57' : c === 'doing' ? pal.accent : c === 'attention' ? '#C98A2C' : pal.textSoft;

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
                  {['todo', 'doing', 'attention', 'done'].map((c) => (
                    <div key={c} style={styles.pill(draft.column === c, COL_TINT(c, pal))}
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
                <div ref={linkBoxRef}>
                  <input
                    style={styles.input}
                    placeholder="Search a contractor, school, or district…"
                    value={linkQuery}
                    onChange={(e) => { setLinkQuery(e.target.value); setLinkOpen(true); }}
                    onFocus={() => setLinkOpen(true)}
                    onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setLinkOpen(false); } }}
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

            {/* Comments — only on saved tasks; needs a real todo.id to attach to */}
            {!isNew && draft.id && (
              <Comments todoId={draft.id} pal={pal} />
            )}
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
    const [uploading, setUploading] = React.useState(null); // file name being uploaded
    const [uploadError, setUploadError] = React.useState(null);
    const urlRef = React.useRef(null);
    const fileInputRef = React.useRef(null);

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
        source: 'link',
      }]);
      reset();
    };

    const remove = async (id) => {
      const target = attachments.find((a) => a.id === id);
      onChange(attachments.filter((a) => a.id !== id));
      if (target && target.storagePath) {
        await deleteAttachmentFile(target);
      }
    };

    const triggerFilePicker = () => {
      setUploadError(null);
      if (fileInputRef.current) fileInputRef.current.click();
    };

    const onFileSelected = async (event) => {
      const file = event.target.files && event.target.files[0];
      event.target.value = '';
      if (!file) return;
      const problem = validateUpload(file);
      if (problem) { setUploadError(problem); return; }
      setUploading(file.name);
      setUploadError(null);
      try {
        const attachment = await uploadAttachmentFile(file);
        onChange([...attachments, attachment]);
      } catch (err) {
        console.warn('upload failed', err);
        setUploadError((err && err.message) ? err.message : 'Upload failed.');
      } finally {
        setUploading(null);
      }
    };

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
              · upload a document or paste a share URL
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {attachments.map((a) => {
            const meta = KIND_META[a.kind] || KIND_META.link;
            const isUpload = !!a.storagePath;
            const subtitle = isUpload
              ? `${meta.full} · ${formatBytes(a.size)}`
              : `${meta.full} · ${hostOf(a.url)}`;
            const openProps = isUpload
              ? {
                  as: 'button',
                  onClick: (e) => { e.stopPropagation(); openUploadedAttachment(a); },
                }
              : {
                  as: 'a',
                  href: a.url,
                  target: '_blank',
                  rel: 'noreferrer',
                  onClick: (e) => e.stopPropagation(),
                };
            const linkStyle = {
              fontSize: 12.5, color: pal.text, fontWeight: 500,
              textDecoration: 'none',
              display: 'block',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              background: 'transparent', border: 'none', padding: 0,
              cursor: 'pointer', textAlign: 'left', width: '100%',
              fontFamily: 'inherit',
            };
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
                  {isUpload ? (
                    <button
                      onClick={openProps.onClick}
                      style={linkStyle}
                      onMouseEnter={(e) => e.currentTarget.style.color = pal.accent}
                      onMouseLeave={(e) => e.currentTarget.style.color = pal.text}>
                      {a.name}
                    </button>
                  ) : (
                    <a href={openProps.href} target={openProps.target} rel={openProps.rel}
                       onClick={openProps.onClick}
                       style={linkStyle}
                       onMouseEnter={(e) => e.currentTarget.style.color = pal.accent}
                       onMouseLeave={(e) => e.currentTarget.style.color = pal.text}>
                      {a.name}
                    </a>
                  )}
                  <div style={{ fontSize: 10.5, color: pal.textFaint, marginTop: 1,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {subtitle}
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
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={triggerFilePicker}
                disabled={!!uploading}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: 'transparent',
                  color: uploading ? pal.textFaint : pal.textSoft,
                  border: `1px dashed ${pal.border}`,
                  borderRadius: 7,
                  fontSize: 12.5, fontWeight: 500,
                  cursor: uploading ? 'default' : 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}
                onMouseEnter={(e) => { if (!uploading) { e.currentTarget.style.borderColor = pal.accent; e.currentTarget.style.color = pal.accent; } }}
                onMouseLeave={(e) => { if (!uploading) { e.currentTarget.style.borderColor = pal.border; e.currentTarget.style.color = pal.textSoft; } }}>
                <Icon name="file" size={12} stroke={2} /> {uploading ? `Uploading ${uploading}…` : 'Upload file'}
              </button>
              <button onClick={() => setAdding(true)}
                disabled={!!uploading}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: 'transparent',
                  color: pal.textSoft,
                  border: `1px dashed ${pal.border}`,
                  borderRadius: 7,
                  fontSize: 12.5, fontWeight: 500,
                  cursor: uploading ? 'default' : 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}
                onMouseEnter={(e) => { if (!uploading) { e.currentTarget.style.borderColor = pal.accent; e.currentTarget.style.color = pal.accent; } }}
                onMouseLeave={(e) => { if (!uploading) { e.currentTarget.style.borderColor = pal.border; e.currentTarget.style.color = pal.textSoft; } }}>
                <Icon name="plus" size={12} stroke={2.4} /> Add link
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={UPLOAD_ACCEPT}
            onChange={onFileSelected}
            style={{ display: 'none' }}
          />
          {uploadError && (
            <div style={{
              fontSize: 11.5, color: pal.warn,
              padding: '6px 10px',
              background: pal.warnSoft || 'transparent',
              border: `1px solid ${pal.warn}`,
              borderRadius: 6,
              marginTop: 2,
            }}>{uploadError}</div>
          )}
        </div>
        <div style={{ fontSize: 10.5, color: pal.textFaint, marginTop: 6, lineHeight: 1.4 }}>
          Documents (PDF, Word, Excel, PowerPoint, CSV, TXT) up to 10 MB. Or paste a Google Drive / Dropbox / any URL.
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
      contact:    { txt: 'CON',  c: '#7A5AE0' },
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

  // ─── Comments sub-component ──────────────────────────────────────────────
  function Comments({ todoId, pal }) {
    const comments = window.useTaskComments(todoId);
    const current = window.TeamStore && window.TeamStore.current && window.TeamStore.current();
    const [draft, setDraft] = React.useState('');
    const [posting, setPosting] = React.useState(false);

    const trimmed = draft.trim();
    const submit = async () => {
      if (!trimmed || posting) return;
      setPosting(true);
      try {
        await window.CommentsStore.add(todoId, trimmed);
        setDraft('');
      } finally {
        setPosting(false);
      }
    };

    const onKeyDown = (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        submit();
      }
    };

    const removeOwn = (id) => {
      if (!confirm('Delete this comment?')) return;
      window.CommentsStore.remove(id);
    };

    return (
      <div>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: 0.4,
          textTransform: 'uppercase', color: pal.textFaint, marginBottom: 5,
        }}>
          Comments
          <span style={{ textTransform: 'none', fontWeight: 500, color: pal.textFaint, marginLeft: 6 }}>
            · {comments.length === 0 ? 'start the conversation' : `${comments.length} so far`}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {comments.length === 0 ? (
            <div style={{
              padding: '12px 14px', fontSize: 12, color: pal.textFaint,
              border: `1px dashed ${pal.border}`, borderRadius: 7,
              textAlign: 'center',
            }}>No comments yet.</div>
          ) : (
            comments.map((c) => {
              const author = teamMember(c.authorId);
              const mine = current && c.authorId === current.id;
              return (
                <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <OwnerAvatar id={c.authorId} size={24} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: pal.text }}>{author.name}</span>
                      <span style={{ fontSize: 10.5, color: pal.textFaint }}>{timeAgo(c.createdAt)}</span>
                      {mine && (
                        <button onClick={() => removeOwn(c.id)} title="Delete comment"
                          style={{
                            marginLeft: 'auto',
                            border: 'none', background: 'transparent',
                            color: pal.textFaint, fontSize: 11, fontWeight: 500,
                            cursor: 'pointer', padding: '0 4px', borderRadius: 4,
                            fontFamily: 'inherit',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = pal.warn}
                          onMouseLeave={(e) => e.currentTarget.style.color = pal.textFaint}>
                          Delete
                        </button>
                      )}
                    </div>
                    <div style={{
                      fontSize: 12.5, color: pal.text, lineHeight: 1.45,
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>{c.content}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={current ? 'Leave a comment… (Cmd+Enter to post)' : 'Sign in to leave a comment.'}
            disabled={!current || posting}
            rows={2}
            style={{
              width: '100%',
              resize: 'vertical',
              minHeight: 56,
              padding: '8px 10px',
              fontSize: 12.5, color: pal.text,
              background: pal.card,
              border: `1px solid ${pal.border}`, borderRadius: 7,
              outline: 'none', fontFamily: 'inherit',
              lineHeight: 1.4,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={submit} disabled={!current || !trimmed || posting}
              style={{
                padding: '6px 14px',
                background: trimmed && current && !posting ? pal.accent : pal.chipBg,
                color: trimmed && current && !posting ? '#fff' : pal.textFaint,
                border: 'none', borderRadius: 6,
                fontSize: 12, fontWeight: 600,
                cursor: trimmed && current && !posting ? 'pointer' : 'default',
                fontFamily: 'inherit',
              }}>
              {posting ? 'Posting…' : 'Comment'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  window.TodoEditor = TodoEditor;
  window.LinkTypeBadge = LinkTypeBadge;
  // Reusable helpers so other editors (e.g., gap-editor.jsx) can share the
  // same Supabase-Storage upload + signed-URL flow.
  window.attachmentHelpers = {
    validateUpload,
    uploadAttachmentFile,
    openUploadedAttachment,
    deleteAttachmentFile,
    formatBytes,
    detectAttachmentKind,
    defaultAttachmentName,
    attachmentId,
    KIND_META,
    UPLOAD_ACCEPT,
  };
})();
