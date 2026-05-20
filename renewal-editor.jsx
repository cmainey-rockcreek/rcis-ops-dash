// RenewalEditor — create / edit a renewal.
// Same modal shape as GapEditor; simpler body. Kind decides what owner picker
// shows (contractor for license/insurance, school OR district for contract).
// Reuses window.attachmentHelpers for uploads.

(function () {
  const { OwnerAvatar, Icon, teamMember } = window;

  const KINDS = [
    { key: 'contractor_license',    label: 'License',           color: '#7A5AE0', needs: 'contractor', stateRequired: true  },
    { key: 'contractor_insurance',  label: 'Insurance',         color: '#1FA39A', needs: 'contractor', stateRequired: false },
    { key: 'contractor_background', label: 'Background check',  color: '#C98A2C', needs: 'contractor', stateRequired: false },
    { key: 'client_contract',       label: 'Client contract',   color: '#E76B5D', needs: 'client',     stateRequired: false },
  ];
  const STATUSES = [
    { key: 'active',  label: 'Active',  color: '#3E8A57' },
    { key: 'pending', label: 'Pending', color: '#C98A2C' },
    { key: 'lapsed',  label: 'Lapsed',  color: '#E76B5D' },
  ];

  function kindMeta(k) { return KINDS.find((x) => x.key === k) || KINDS[0]; }

  // ─── Editor ───────────────────────────────────────────────────────────────
  function RenewalEditor({ renewal, pal, onSave, onDelete, onClose, isNew }) {
    const [draft, setDraft] = React.useState({
      id: null,
      kind: 'contractor_license',
      contractorId: null, contractorName: '',
      schoolId: null, schoolName: '',
      districtId: null, districtName: '',
      label: '',
      state: '',
      expiresOn: '',
      status: 'active',
      note: '',
      attachments: [],
      ...renewal,
    });
    const [scopeOpen, setScopeOpen] = React.useState(false);
    const [scopeQuery, setScopeQuery] = React.useState('');
    const scopeBoxRef = React.useRef(null);

    const meta = kindMeta(draft.kind);

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

    const ownerPicked = meta.needs === 'contractor'
      ? !!draft.contractorId
      : !!(draft.schoolId || draft.districtId);

    const ownerOptions = React.useMemo(() => {
      const q = scopeQuery.trim().toLowerCase();
      const match = (s) => !q || (s || '').toLowerCase().includes(q);
      const out = [];
      if (meta.needs === 'contractor') {
        const raw = (window.RCIS_DATA && window.RCIS_DATA.CONTRACTORS) || [];
        // Apply name/contact overrides synchronously so picker results reflect renames.
        const contractors = window.applyContractorOverride
          ? raw.map((c) => window.applyContractorOverride(c))
          : raw;
        contractors.forEach((c) => {
          const sub = [c.spec, (c.states || []).slice(0, 3).join(', ')].filter(Boolean).join(' · ');
          if (match(c.name) || match(c.spec) || match((c.states || []).join(' '))) {
            out.push({ type: 'contractor', id: c.id, name: c.name, state: (c.states || [])[0] || '', sub });
          }
        });
      } else {
        const districtsRaw = (window.RCIS_DATA && window.RCIS_DATA.DISTRICTS) || [];
        const schoolsRaw = (window.RCIS_DATA && window.RCIS_DATA.SCHOOLS) || [];
        const districts = window.applyDistrictOverride
          ? districtsRaw.map((d) => window.applyDistrictOverride(d))
          : districtsRaw;
        const schools = window.applySchoolOverride
          ? schoolsRaw.map((s) => window.applySchoolOverride(s))
          : schoolsRaw;
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
      }
      return out.slice(0, 40);
    }, [scopeQuery, meta.needs]);

    const pickOwner = (opt) => {
      if (opt.type === 'contractor') {
        set({
          contractorId: opt.id, contractorName: opt.name,
          schoolId: null, schoolName: '', districtId: null, districtName: '',
          state: draft.state || opt.state || '',
        });
      } else if (opt.type === 'school') {
        set({
          contractorId: null, contractorName: '',
          schoolId: opt.id, schoolName: opt.name,
          districtId: opt.districtId, districtName: opt.districtName,
          state: opt.state,
        });
      } else {
        set({
          contractorId: null, contractorName: '',
          schoolId: null, schoolName: '',
          districtId: opt.id, districtName: opt.name,
          state: opt.state,
        });
      }
      setScopeOpen(false);
      setScopeQuery('');
    };

    const clearOwner = () => {
      set({
        contractorId: null, contractorName: '',
        schoolId: null, schoolName: '', districtId: null, districtName: '',
      });
      setScopeOpen(true);
      setScopeQuery('');
    };

    // When kind switches between contractor↔client, drop the owner so the
    // picker shows the right options.
    const switchKind = (nextKind) => {
      const nextMeta = kindMeta(nextKind);
      const currentMeta = kindMeta(draft.kind);
      if (nextMeta.needs !== currentMeta.needs) {
        set({
          kind: nextKind,
          contractorId: null, contractorName: '',
          schoolId: null, schoolName: '', districtId: null, districtName: '',
        });
      } else {
        set({ kind: nextKind });
      }
    };

    const handleSave = () => {
      if (!ownerPicked) { setScopeOpen(true); return; }
      if (!draft.expiresOn) return;
      if (meta.stateRequired && !draft.state) return;
      onSave({ ...draft });
    };

    const styles = makeStyles(pal);
    const days = window.daysUntilRenewal ? window.daysUntilRenewal(draft.expiresOn) : null;
    let daysHint = '';
    let daysColor = pal.textFaint;
    if (days !== null && draft.expiresOn) {
      if (days < 0)       { daysHint = `${Math.abs(days)}d overdue`; daysColor = '#E76B5D'; }
      else if (days === 0){ daysHint = 'expires today';              daysColor = '#E76B5D'; }
      else if (days <= 30){ daysHint = `${days}d to go`;             daysColor = '#C98A2C'; }
      else                 { daysHint = `${days}d to go`;             daysColor = pal.textSoft; }
    }

    const ownerLabel = (() => {
      if (meta.needs === 'contractor') return draft.contractorName;
      return draft.schoolName || draft.districtName;
    })();
    const ownerSub = (() => {
      if (meta.needs === 'contractor') return draft.state ? `${draft.state}` : '';
      if (draft.schoolName) return `${draft.districtName || '—'} · ${draft.state || ''}`;
      return `${draft.state || ''} · district-wide`;
    })();
    const ownerBadge = (() => {
      if (meta.needs === 'contractor') return { label: 'CON',  color: '#7A5AE0' };
      if (draft.schoolName) return { label: 'SCH', color: '#E76B5D' };
      return { label: 'DIST', color: pal.accent };
    })();

    return (
      <div style={styles.backdrop} onClick={onClose}>
        <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div style={styles.header}>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: pal.text }}>
              {isNew ? 'Log renewal' : 'Edit renewal'}
            </div>
            <div style={{ fontSize: 11, color: pal.textFaint }}>
              {!isNew && draft.updatedAt && `Last edited ${timeAgo(draft.updatedAt)}`}
            </div>
            <button onClick={onClose} style={styles.btnIcon} aria-label="Close">×</button>
          </div>

          <div style={styles.body}>
            {/* Kind picker — three colored pills */}
            <div>
              <div style={styles.label}>Type</div>
              <div style={styles.pillRow}>
                {KINDS.map((k) => (
                  <div key={k.key}
                    style={styles.pill(draft.kind === k.key, k.color)}
                    onClick={() => switchKind(k.key)}>{k.label}</div>
                ))}
              </div>
            </div>

            {/* Owner picker — contractor OR school/district */}
            <div>
              <div style={styles.label}>
                {meta.needs === 'contractor' ? 'Contractor' : 'School or district'}
              </div>
              {ownerPicked && !scopeOpen ? (
                <div style={styles.scopePicked}>
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: 0.6,
                    padding: '3px 6px', borderRadius: 4,
                    background: ownerBadge.color + '22', color: ownerBadge.color,
                  }}>{ownerBadge.label}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: pal.text, fontWeight: 600, fontSize: 13 }}>{ownerLabel}</div>
                    <div style={{ color: pal.textFaint, fontSize: 11, marginTop: 1 }}>{ownerSub}</div>
                  </div>
                  <button onClick={clearOwner}
                    style={{ ...styles.btnSecondary, padding: '4px 9px', fontSize: 11.5 }}>Change</button>
                </div>
              ) : (
                <div ref={scopeBoxRef}>
                  <input
                    autoFocus
                    style={styles.input}
                    placeholder={meta.needs === 'contractor' ? 'Search a contractor…' : 'Search a school or district…'}
                    value={scopeQuery}
                    onChange={(e) => { setScopeQuery(e.target.value); setScopeOpen(true); }}
                    onFocus={() => setScopeOpen(true)}
                    onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setScopeOpen(false); } }}
                  />
                  {scopeOpen && (
                    <div style={styles.scopeList}>
                      {ownerOptions.length === 0 ? (
                        <div style={{ padding: '10px 12px', fontSize: 12.5, color: pal.textFaint }}>No matches.</div>
                      ) : ownerOptions.map((opt) => {
                        const badge = opt.type === 'contractor' ? { label: 'CON',  color: '#7A5AE0' }
                                    : opt.type === 'school'     ? { label: 'SCH',  color: '#E76B5D' }
                                                                : { label: 'DIST', color: pal.accent };
                        return (
                          <div key={opt.type + opt.id}
                            onClick={() => pickOwner(opt)}
                            style={styles.scopeRow}
                            onMouseEnter={(e) => e.currentTarget.style.background = pal.chipBg}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                            <span style={{
                              fontSize: 9, fontWeight: 800, letterSpacing: 0.6,
                              padding: '3px 6px', borderRadius: 4,
                              background: badge.color + '22', color: badge.color,
                              flexShrink: 0,
                            }}>{badge.label}</span>
                            <span style={{ color: pal.text, fontWeight: 500, flex: 1, fontSize: 13 }}>{opt.name}</span>
                            <span style={{ color: pal.textFaint, fontSize: 11 }}>{opt.sub}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Label + State (state only when relevant) */}
            <div style={meta.needs === 'contractor' && meta.stateRequired ? styles.row : { display: 'block' }}>
              <div>
                <div style={styles.label}>
                  {draft.kind === 'contractor_license'    ? 'License (e.g. BCBA, RBT, SLP)'
                   : draft.kind === 'contractor_insurance'  ? 'Policy name + carrier'
                   : draft.kind === 'contractor_background' ? 'Background check type'
                   : 'Contract name (e.g. MSA, Year-3)'}
                </div>
                <input
                  type="text"
                  value={draft.label}
                  onChange={(e) => set({ label: e.target.value })}
                  placeholder={
                    draft.kind === 'contractor_license'    ? 'BCBA License'
                    : draft.kind === 'contractor_insurance'  ? 'Professional Liability — HPSO'
                    : draft.kind === 'contractor_background' ? 'BIA fingerprint clearance'
                    : 'Service Agreement'
                  }
                  style={styles.input}
                />
              </div>
              {meta.needs === 'contractor' && meta.stateRequired && (
                <div>
                  <div style={styles.label}>State</div>
                  <input
                    type="text"
                    value={draft.state}
                    onChange={(e) => set({ state: e.target.value.toUpperCase().slice(0, 2) })}
                    placeholder="CA"
                    maxLength={2}
                    style={{ ...styles.input, textTransform: 'uppercase' }}
                  />
                </div>
              )}
            </div>

            {/* Expiration date + Status */}
            <div style={styles.row}>
              <div>
                <div style={styles.label}>
                  Expires on
                  {daysHint && (
                    <span style={{
                      textTransform: 'none', fontWeight: 600, marginLeft: 8,
                      color: daysColor,
                    }}>· {daysHint}</span>
                  )}
                </div>
                <input
                  type="date"
                  value={draft.expiresOn || ''}
                  onChange={(e) => set({ expiresOn: e.target.value })}
                  style={styles.input}
                />
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
                placeholder="Renewal contact, portal link, what's outstanding…"
                style={{ ...styles.input, padding: '9px 11px', resize: 'vertical', minHeight: 70 }} />
            </div>

            {/* Attachments — passes the editor's apply-fields callback so a
                PDF dropped here can prefill expiration / state / label. */}
            <RenewalAttachments
              attachments={draft.attachments}
              onChange={(next) => set({ attachments: next })}
              pal={pal}
              draft={draft}
              applyParsed={(patch) => set(patch)}
            />
          </div>

          <div style={styles.footer}>
            {!isNew && (
              <button style={styles.btnDanger}
                onClick={() => { if (confirm('Delete this renewal?')) onDelete(); }}>
                Delete
              </button>
            )}
            <span style={{ flex: 1 }} />
            <button style={styles.btnSecondary} onClick={onClose}>Cancel</button>
            <button style={styles.btnPrimary} onClick={handleSave}>
              {isNew ? 'Log renewal' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Attachments sub-component (mirrors GapAttachments) ──────────────────
  function RenewalAttachments({ attachments, onChange, pal, draft, applyParsed }) {
    const helpers = window.attachmentHelpers || {};
    const [adding, setAdding] = React.useState(false);
    const [url, setUrl] = React.useState('');
    const [name, setName] = React.useState('');
    const [uploading, setUploading] = React.useState(null);
    const [uploadError, setUploadError] = React.useState(null);
    const [suggestion, setSuggestion] = React.useState(null);
    const [parsing, setParsing] = React.useState(false);
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
      // Kick off PDF parsing in parallel with the upload. If the file isn't a
      // PDF or parsing fails silently, no banner appears.
      const parsePromise = (file.type === 'application/pdf' || /\.pdf$/i.test(file.name))
        && window.parsePdfForRenewal
        ? (setParsing(true), window.parsePdfForRenewal(file).catch(() => null))
        : Promise.resolve(null);
      try {
        const attachment = await helpers.uploadAttachmentFile(file);
        onChange([...attachments, attachment]);
      } catch (err) {
        console.warn('upload failed', err);
        setUploadError((err && err.message) ? err.message : 'Upload failed.');
      } finally {
        setUploading(null);
      }
      const parsed = await parsePromise;
      setParsing(false);
      if (parsed && (parsed.expiresOn || parsed.label || parsed.state)) {
        setSuggestion({ ...parsed, sourceFile: file.name });
      }
    };

    const applySuggestion = () => {
      if (!suggestion || !applyParsed) { setSuggestion(null); return; }
      const patch = {};
      if (suggestion.expiresOn && !draft.expiresOn) patch.expiresOn = suggestion.expiresOn;
      if (suggestion.state && !draft.state)         patch.state     = suggestion.state;
      if (suggestion.label && !draft.label)         patch.label     = suggestion.label;
      applyParsed(patch);
      setSuggestion(null);
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
            · upload the policy / license PDF or paste a URL
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
              textDecoration: 'none', display: 'block',
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
                  borderRadius: 4, fontFamily: 'ui-monospace, monospace',
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
                <button onClick={() => remove(a.id)} title="Remove attachment"
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
              padding: 10, background: pal.cardAlt,
              border: `1px dashed ${pal.border}`, borderRadius: 7,
              display: 'flex', flexDirection: 'column', gap: 7,
            }}>
              <input
                ref={urlRef}
                placeholder="Paste URL — share link to PDF, certificate, contract…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') reset(); }}
                style={{
                  width: '100%', padding: '7px 10px',
                  fontSize: 12.5, color: pal.text, background: pal.card,
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
                    fontSize: 12.5, color: pal.text, background: pal.card,
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
              borderRadius: 6, marginTop: 2,
            }}>{uploadError}</div>
          )}

          {parsing && (
            <div style={{
              fontSize: 11.5, color: pal.textSoft,
              padding: '6px 10px',
              border: `1px dashed ${pal.border}`, borderRadius: 6,
              marginTop: 2,
            }}>Reading document for license details…</div>
          )}

          {suggestion && (
            <div style={{
              padding: '10px 12px',
              background: pal.accentSoft || (pal.accent + '12'),
              border: `1px solid ${pal.accent}40`,
              borderRadius: 8, marginTop: 2,
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
                textTransform: 'uppercase', color: pal.accent }}>
                Suggested from {suggestion.sourceFile}
              </div>
              <div style={{ fontSize: 12.5, color: pal.text, lineHeight: 1.5 }}>
                {suggestion.expiresOn && (<div><b>Expires:</b> {suggestion.expiresOn}</div>)}
                {suggestion.state && (<div><b>State:</b> {suggestion.state}</div>)}
                {suggestion.label && (<div><b>License / type:</b> {suggestion.label}</div>)}
                {suggestion.licenseNumber && (<div><b>Number:</b> {suggestion.licenseNumber}</div>)}
                {suggestion.confidence != null && (
                  <div style={{ fontSize: 10.5, color: pal.textFaint, marginTop: 3 }}>
                    Confidence {Math.round(suggestion.confidence * 100)}% — please double-check.
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                <button onClick={applySuggestion}
                  style={{
                    padding: '6px 12px',
                    background: pal.accent, color: '#fff',
                    border: 'none', borderRadius: 6,
                    fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>Apply to form</button>
                <button onClick={() => setSuggestion(null)}
                  style={{
                    padding: '6px 10px',
                    background: 'transparent', color: pal.textSoft,
                    border: `1px solid ${pal.border}`, borderRadius: 6,
                    fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>Dismiss</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  function dashedBtn(pal, disabled) {
    return {
      flex: 1, padding: '8px 12px',
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
        background: pal.card, color: pal.text,
        borderRadius: 14,
        width: '100%', maxWidth: 560, maxHeight: '92vh',
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

  // Expose kind metadata so the list/widget can render consistent labels/colors
  window.RENEWAL_KINDS = KINDS;
  window.RENEWAL_STATUSES = STATUSES;
  window.renewalKindMeta = kindMeta;
  window.RenewalEditor = RenewalEditor;
})();
