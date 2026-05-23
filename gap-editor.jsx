// GapEditor — create / edit a coverage gap.
// Modeled on TodoEditor: same modal shape, same pill rows, reuses the
// attachments upload flow via window.attachmentHelpers. Comments are wired
// to GapCommentsStore. Scope picker accepts schools OR districts so a
// district-wide position can be logged.

(function () {
  const { OwnerAvatar, Icon, teamMember } = window;

  const SPECIALTIES = (window.RCIS_DATA && window.RCIS_DATA.SPECIALTIES) || [];
  const MODALITIES = [
    { key: 'onsite', label: 'Onsite' },
    { key: 'tele',   label: 'Tele' },
    { key: 'either', label: 'Either' },
  ];
  const PRIORITIES = [
    { key: 'urgent', label: 'Urgent', color: '#E76B5D' },
    { key: 'high',   label: 'High',   color: '#D97757' },
    { key: 'medium', label: 'Medium', color: '#C98A2C' },
    { key: 'low',    label: 'Low',    color: '#7A8290' },
  ];
  const STATUSES = [
    { key: 'open',   label: 'Open',   color: '#C98A2C' },
    { key: 'filled', label: 'Filled', color: '#3E8A57' },
    { key: 'closed', label: 'Closed', color: '#7A8290' },
  ];
  const DEFAULT_BILL_RATE = 85;

  // ─── Editor ───────────────────────────────────────────────────────────────
  function GapEditor({ gap, pal, onSave, onDelete, onClose, isNew }) {
    const [draft, setDraft] = React.useState({
      id: null,
      scope: 'school',
      schoolId: null, schoolName: null,
      districtId: null, districtName: '',
      state: '', spec: SPECIALTIES[0] ? SPECIALTIES[0].code : 'SLP',
      hours: 8,
      modality: 'onsite',
      priority: 'medium',
      // Empty until either (a) the prefill effect resolves a value from
      // the district rate card / spec default, or (b) the user types one.
      // handleSave falls back to DEFAULT_BILL_RATE if it's still blank.
      billRate: null,
      note: '',
      status: 'open',
      attachments: [],
      ...gap,
    });
    const [scopeOpen, setScopeOpen] = React.useState(false);
    const [scopeQuery, setScopeQuery] = React.useState('');
    const scopeBoxRef = React.useRef(null);

    React.useEffect(() => {
      if (!scopeOpen) return;
      const onMouseDown = (e) => {
        if (scopeBoxRef.current && !scopeBoxRef.current.contains(e.target)) {
          setScopeOpen(false);
        }
      };
      document.addEventListener('mousedown', onMouseDown);
      return () => document.removeEventListener('mousedown', onMouseDown);
    }, [scopeOpen]);

    React.useEffect(() => {
      const onKey = (e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    });

    const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

    // Prefill bill rate from the district rate card when a new gap arrives
    // with a known (district, spec). Only fills when the user hasn't typed
    // a value yet (null / blank) — never overwrites a user-typed number,
    // even one that happens to equal DEFAULT_BILL_RATE.
    React.useEffect(() => {
      if (!isNew) return;
      if (!draft.districtId || !draft.spec) return;
      const stored = draft.billRate;
      if (stored != null && stored !== '') return;
      const card = window.rateCardFor
        ? window.rateCardFor(draft.districtId, draft.spec)
        : null;
      const fallback = window.defaultBillFor ? window.defaultBillFor(draft.spec) : null;
      const next = (Number.isFinite(card) && card > 0)
        ? card
        : (Number.isFinite(fallback) && fallback > 0 ? fallback : null);
      if (next != null) set({ billRate: next });
    }, [isNew, draft.districtId, draft.spec]);

    const scopeOptions = React.useMemo(() => {
      const out = [];
      const q = scopeQuery.trim().toLowerCase();
      const match = (s) => !q || s.toLowerCase().includes(q);
      const districts = (window.RCIS_DATA && window.RCIS_DATA.DISTRICTS) || [];
      const schools = (window.RCIS_DATA && window.RCIS_DATA.SCHOOLS) || [];
      districts.forEach((d) => {
        if (match(d.name) || match(d.state)) {
          out.push({ type: 'district', id: d.id, name: d.name, state: d.state, sub: `${d.state} · district-wide` });
        }
      });
      schools.forEach((s) => {
        const dist = districts.find((d) => d.id === s.district);
        const distName = dist ? dist.name : '';
        if (match(s.name) || match(s.state) || match(distName)) {
          out.push({
            type: 'school', id: s.id, name: s.name, state: s.state,
            districtId: s.district || null, districtName: distName,
            sub: `${distName} · ${s.state}`,
          });
        }
      });
      return out.slice(0, 30);
    }, [scopeQuery]);

    const pickScope = (opt) => {
      if (opt.type === 'school') {
        set({
          scope: 'school',
          schoolId: opt.id,
          schoolName: opt.name,
          districtId: opt.districtId,
          districtName: opt.districtName,
          state: opt.state,
        });
      } else {
        set({
          scope: 'district',
          schoolId: null,
          schoolName: null,
          districtId: opt.id,
          districtName: opt.name,
          state: opt.state,
        });
      }
      setScopeOpen(false);
      setScopeQuery('');
    };

    const handleSave = () => {
      if (!draft.districtName && !draft.schoolName) { setScopeOpen(true); return; }
      if (!draft.spec || !draft.state) return;
      onSave({
        ...draft,
        hours: Number(draft.hours) || 0,
        billRate: Number(draft.billRate) || DEFAULT_BILL_RATE,
      });
    };

    const styles = makeStyles(pal);

    return (
      <div style={styles.backdrop} onClick={onClose}>
        <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div style={styles.header}>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: pal.text }}>
              {isNew ? 'Log coverage gap' : 'Edit coverage gap'}
            </div>
            <div style={{ fontSize: 11, color: pal.textFaint }}>
              {!isNew && draft.updatedAt && `Last edited ${timeAgo(draft.updatedAt)}`}
            </div>
            <button onClick={onClose} style={styles.btnIcon} aria-label="Close">×</button>
          </div>

          <div style={styles.body}>
            {/* Scope picker — school or district */}
            <div>
              <div style={styles.label}>Where</div>
              {(draft.schoolName || draft.districtName) && !scopeOpen ? (
                <div style={styles.scopePicked}>
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: 0.6,
                    padding: '3px 6px', borderRadius: 4,
                    background: draft.scope === 'school' ? '#E76B5D22' : '#1B295622',
                    color: draft.scope === 'school' ? '#E76B5D' : pal.accent,
                  }}>{draft.scope === 'school' ? 'SCHOOL' : 'DISTRICT'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: pal.text, fontWeight: 600, fontSize: 13 }}>
                      {draft.schoolName || draft.districtName}
                    </div>
                    <div style={{ color: pal.textFaint, fontSize: 11, marginTop: 1 }}>
                      {draft.scope === 'school'
                        ? `${draft.districtName} · ${draft.state}`
                        : `${draft.state} · district-wide`}
                    </div>
                  </div>
                  <button onClick={() => { setScopeOpen(true); setScopeQuery(''); }}
                    style={{ ...styles.btnSecondary, padding: '4px 9px', fontSize: 11.5 }}>Change</button>
                </div>
              ) : (
                <div ref={scopeBoxRef}>
                  <input
                    autoFocus
                    style={styles.input}
                    placeholder="Search a school or district…"
                    value={scopeQuery}
                    onChange={(e) => { setScopeQuery(e.target.value); setScopeOpen(true); }}
                    onFocus={() => setScopeOpen(true)}
                    onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setScopeOpen(false); } }}
                  />
                  {scopeOpen && (
                    <div style={styles.scopeList}>
                      {scopeOptions.length === 0 ? (
                        <div style={{ padding: '10px 12px', fontSize: 12.5, color: pal.textFaint }}>No matches.</div>
                      ) : scopeOptions.map((opt) => (
                        <div key={opt.type + opt.id}
                          onClick={() => pickScope(opt)}
                          style={styles.scopeRow}
                          onMouseEnter={(e) => e.currentTarget.style.background = pal.chipBg}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                          <span style={{
                            fontSize: 9, fontWeight: 800, letterSpacing: 0.6,
                            padding: '3px 6px', borderRadius: 4,
                            background: opt.type === 'school' ? '#E76B5D22' : '#1B295622',
                            color: opt.type === 'school' ? '#E76B5D' : pal.accent,
                            flexShrink: 0,
                          }}>{opt.type === 'school' ? 'SCH' : 'DIST'}</span>
                          <span style={{ color: pal.text, fontWeight: 500, flex: 1, fontSize: 13 }}>{opt.name}</span>
                          <span style={{ color: pal.textFaint, fontSize: 11 }}>{opt.sub}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Specialty + Hours */}
            <div style={styles.row}>
              <div>
                <div style={styles.label}>Specialty</div>
                <select value={draft.spec} onChange={(e) => set({ spec: e.target.value })}
                  style={styles.input}>
                  {SPECIALTIES.map((s) => (
                    <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={styles.label}>Hours / week</div>
                <input type="number" min="0" step="1"
                  value={draft.hours}
                  onChange={(e) => set({ hours: e.target.value })}
                  style={styles.input} />
              </div>
            </div>

            {/* Modality + Priority */}
            <div style={styles.row}>
              <div>
                <div style={styles.label}>Modality</div>
                <div style={styles.pillRow}>
                  {MODALITIES.map((m) => (
                    <div key={m.key}
                      style={styles.pill(draft.modality === m.key, pal.accent)}
                      onClick={() => set({ modality: m.key })}>{m.label}</div>
                  ))}
                </div>
              </div>
              <div>
                <div style={styles.label}>Urgency</div>
                <div style={styles.pillRow}>
                  {PRIORITIES.map((p) => (
                    <div key={p.key}
                      style={styles.pill(draft.priority === p.key, p.color)}
                      onClick={() => set({ priority: p.key })}>{p.label}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bill rate + Status */}
            <div style={styles.row}>
              <div>
                <div style={styles.label}>Bill rate ($ / hr)</div>
                <input type="number" min="0" step="1"
                  value={draft.billRate == null ? '' : draft.billRate}
                  placeholder={String(DEFAULT_BILL_RATE)}
                  onChange={(e) => set({ billRate: e.target.value })}
                  style={styles.input} />
              </div>
              <div>
                <div style={styles.label}>Status</div>
                <div style={styles.pillRow}>
                  {STATUSES.map((s) => (
                    <div key={s.key}
                      style={styles.pill(draft.status === s.key, s.color)}
                      onClick={() => set({ status: s.key })}>{s.label}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <div style={styles.label}>Notes</div>
              <textarea value={draft.note}
                onChange={(e) => set({ note: e.target.value })}
                rows={3}
                placeholder="Context, contractor on leave, special requirements…"
                style={{ ...styles.input, padding: '9px 11px', resize: 'vertical', minHeight: 70 }} />
            </div>

            {/* Attachments */}
            <GapAttachments
              attachments={draft.attachments}
              onChange={(next) => set({ attachments: next })}
              pal={pal}
            />

            {/* Comments — only for saved gaps */}
            {!isNew && draft.id && (
              <GapComments gapId={draft.id} pal={pal} />
            )}
          </div>

          <div style={styles.footer}>
            {!isNew && (
              <button style={styles.btnDanger}
                onClick={() => { if (confirm('Delete this coverage gap?')) onDelete(); }}>
                Delete
              </button>
            )}
            <span style={{ flex: 1 }} />
            <button style={styles.btnSecondary} onClick={onClose}>Cancel</button>
            <button style={styles.btnPrimary} onClick={handleSave}>
              {isNew ? 'Log gap' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Attachments sub-component (uses shared helpers) ─────────────────────
  function GapAttachments({ attachments, onChange, pal }) {
    const helpers = window.attachmentHelpers || {};
    const [adding, setAdding] = React.useState(false);
    const [url, setUrl] = React.useState('');
    const [name, setName] = React.useState('');
    const [uploading, setUploading] = React.useState(null);
    const [uploadError, setUploadError] = React.useState(null);
    const urlRef = React.useRef(null);
    const fileInputRef = React.useRef(null);

    const reset = () => { setAdding(false); setUrl(''); setName(''); };
    const commit = () => {
      const trimmed = url.trim();
      if (!trimmed) return;
      const finalName = name.trim() || (helpers.defaultAttachmentName ? helpers.defaultAttachmentName(trimmed) : trimmed);
      const kind = helpers.detectAttachmentKind ? helpers.detectAttachmentKind(trimmed, finalName) : 'link';
      onChange([...attachments, {
        id: helpers.attachmentId ? helpers.attachmentId() : 'a' + Date.now(),
        kind, url: trimmed, name: finalName,
        addedAt: Date.now(),
        source: 'link',
      }]);
      reset();
    };

    const remove = async (id) => {
      const target = attachments.find((a) => a.id === id);
      onChange(attachments.filter((a) => a.id !== id));
      if (target && target.storagePath && helpers.deleteAttachmentFile) {
        await helpers.deleteAttachmentFile(target);
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
      const problem = helpers.validateUpload ? helpers.validateUpload(file) : null;
      if (problem) { setUploadError(problem); return; }
      setUploading(file.name);
      setUploadError(null);
      try {
        const attachment = await helpers.uploadAttachmentFile(file);
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

    const KIND_META = helpers.KIND_META || {};

    return (
      <div>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: 0.4,
          textTransform: 'uppercase', color: pal.textFaint, marginBottom: 5,
        }}>
          Supporting documentation
          <span style={{ textTransform: 'none', fontWeight: 500, color: pal.textFaint, marginLeft: 6 }}>
            · upload a doc or paste a share URL
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {attachments.map((a) => {
            const meta = KIND_META[a.kind] || KIND_META.link || { abbr: 'LINK', full: 'Link', color: '#5A6478' };
            const isUpload = !!a.storagePath;
            const subtitle = isUpload
              ? `${meta.full} · ${helpers.formatBytes ? helpers.formatBytes(a.size) : ''}`
              : `${meta.full} · ${hostOf(a.url)}`;
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
                border: `1px solid ${pal.border}`, borderRadius: 7,
              }}>
                <span style={{
                  flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 44, padding: '3px 7px',
                  background: meta.color + '20', color: meta.color,
                  fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6,
                  borderRadius: 4,
                  fontFamily: 'ui-monospace, monospace',
                }}>{meta.abbr}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isUpload ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); helpers.openUploadedAttachment && helpers.openUploadedAttachment(a); }}
                      style={linkStyle}
                      onMouseEnter={(e) => e.currentTarget.style.color = pal.accent}
                      onMouseLeave={(e) => e.currentTarget.style.color = pal.text}>
                      {a.name}
                    </button>
                  ) : (
                    <a href={a.url} target="_blank" rel="noreferrer"
                       onClick={(e) => e.stopPropagation()}
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
                  onMouseEnter={(e) => { e.currentTarget.style.color = pal.warn; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = pal.textFaint; }}>×</button>
              </div>
            );
          })}

          {adding ? (
            <div style={{
              padding: 10,
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
                  placeholder="Display name (optional)"
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
                style={dashedBtn(pal, !!uploading)}>
                <Icon name="file" size={12} stroke={2} />
                {uploading ? `Uploading ${uploading}…` : 'Upload file'}
              </button>
              <button onClick={() => setAdding(true)}
                disabled={!!uploading}
                style={dashedBtn(pal, !!uploading)}>
                <Icon name="plus" size={12} stroke={2.4} /> Add link
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={helpers.UPLOAD_ACCEPT || '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt'}
            onChange={onFileSelected}
            style={{ display: 'none' }}
          />
          {uploadError && (
            <div style={{
              fontSize: 11.5, color: pal.warn,
              padding: '6px 10px',
              border: `1px solid ${pal.warn}`,
              borderRadius: 6,
              marginTop: 2,
            }}>{uploadError}</div>
          )}
        </div>
      </div>
    );
  }

  // ─── Comments sub-component ──────────────────────────────────────────────
  function GapComments({ gapId, pal }) {
    const comments = window.useGapComments ? window.useGapComments(gapId) : [];
    const current = window.TeamStore && window.TeamStore.current && window.TeamStore.current();
    const [draft, setDraft] = React.useState('');
    const [posting, setPosting] = React.useState(false);

    const trimmed = draft.trim();
    const submit = async () => {
      if (!trimmed || posting) return;
      setPosting(true);
      try {
        await window.GapCommentsStore.add(gapId, trimmed);
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
      window.GapCommentsStore.remove(id);
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
              width: '100%', resize: 'vertical', minHeight: 56,
              padding: '8px 10px',
              fontSize: 12.5, color: pal.text,
              background: pal.card,
              border: `1px solid ${pal.border}`, borderRadius: 7,
              outline: 'none', fontFamily: 'inherit', lineHeight: 1.4,
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

  function dashedBtn(pal, disabled) {
    return {
      flex: 1,
      padding: '8px 12px',
      background: 'transparent',
      color: disabled ? pal.textFaint : pal.textSoft,
      border: `1px dashed ${pal.border}`,
      borderRadius: 7,
      fontSize: 12.5, fontWeight: 500,
      cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    };
  }
  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch (e) { return ''; }
  }
  function timeAgo(t) {
    const sec = Math.floor((Date.now() - t) / 1000);
    if (sec < 60) return 'just now';
    if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
    if (sec < 86400) return Math.floor(sec / 3600) + 'h ago';
    return Math.floor(sec / 86400) + 'd ago';
  }

  function makeStyles(pal) {
    return {
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
        width: '100%', maxWidth: 560,
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
        color: pal.textFaint, marginBottom: 5,
      },
      input: {
        width: '100%', padding: '8px 11px',
        fontSize: 14, color: pal.text,
        background: pal.cardAlt,
        border: `1px solid ${pal.border}`, borderRadius: 7,
        outline: 'none', fontFamily: 'inherit', lineHeight: 1.4,
      },
      scopePicked: {
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px',
        background: pal.cardAlt,
        border: `1px solid ${pal.border}`, borderRadius: 7,
      },
      scopeList: {
        marginTop: 6, maxHeight: 220, overflowY: 'auto',
        background: pal.cardAlt,
        border: `1px solid ${pal.border}`, borderRadius: 7,
      },
      scopeRow: {
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '7px 11px',
        cursor: 'pointer', fontSize: 13,
        borderBottom: `1px solid ${pal.borderSoft}`,
      },
      row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
      pillRow: { display: 'flex', gap: 6 },
      pill: (on, color) => ({
        flex: 1, minHeight: 34, padding: '6px 8px',
        fontSize: 12, fontWeight: 600,
        lineHeight: 1.2, textAlign: 'center', whiteSpace: 'nowrap',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 7,
        border: `1px solid ${on ? color : pal.border}`,
        background: on ? color + '18' : 'transparent',
        color: on ? color : pal.textSoft,
        cursor: 'pointer', userSelect: 'none',
        transition: 'background .12s, border-color .12s, color .12s',
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
        border: `1px solid ${pal.warn}40`, borderRadius: 7,
        fontSize: 13, fontWeight: 500,
        cursor: 'pointer', fontFamily: 'inherit',
      },
      btnIcon: {
        width: 28, height: 28, padding: 0,
        background: 'transparent', color: pal.textSoft,
        border: 'none', borderRadius: 6,
        fontSize: 18, lineHeight: 1, cursor: 'pointer',
      },
    };
  }

  window.GapEditor = GapEditor;
})();
