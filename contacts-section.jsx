// ContactsSection — shared card used on district + school detail pages.
// Pulls from ContactsStore, lets the user add / edit / delete contacts and
// tag them to multiple districts and schools.

(function () {
  const { Icon } = window;

  // Pretty label for a link target.
  function linkLabel(link) {
    if (link.type === 'school') {
      const s = window.RCIS_DATA.SCHOOLS.find((x) => x.id === link.id);
      return s ? s.name : 'School ?';
    }
    if (link.type === 'district') {
      const d = window.RCIS_DATA.DISTRICTS.find((x) => x.id === link.id);
      return d ? d.name : 'District ?';
    }
    return '?';
  }
  function linkBadgeColor(type, pal) {
    if (type === 'district') return { bg: pal.accentSoft, fg: pal.accent };
    return { bg: pal.chipBg, fg: pal.textSoft };
  }

  // ─── Section card ─────────────────────────────────────────────────────────
  function ContactsSection({ pal, scope, scopeId, title }) {
    // scope: 'district' | 'school'
    // includeDistrict: when viewing a school, surface contacts tagged at the
    // parent district too (with a small note that they're district-wide).
    const allContacts = window.useContacts();
    const [editor, setEditor] = React.useState(null); // { contact, isNew } | null

    const list = React.useMemo(() => {
      if (scope === 'district') return window.ContactsStore.forDistrict(scopeId);
      return window.ContactsStore.forSchool(scopeId, { includeDistrict: true });
    }, [allContacts, scope, scopeId]);

    const parentDistrictId = scope === 'school'
      ? (window.RCIS_DATA.SCHOOLS.find((s) => s.id === scopeId) || {}).district
      : null;

    const openNew = () => {
      const linkedTo = scope === 'district'
        ? [{ type: 'district', id: scopeId }]
        : [{ type: 'school',   id: scopeId }];
      setEditor({
        contact: {
          id: null, name: '', role: '',
          email: '', phone: '', organization: '',
          linkedTo,
        },
        isNew: true,
      });
    };
    const openEdit = (c) => setEditor({ contact: { ...c, linkedTo: [...c.linkedTo] }, isNew: false });
    const close = () => setEditor(null);
    const save = (patch) => {
      if (editor.isNew) {
        const { id, ...rest } = patch;
        window.ContactsStore.add(rest);
      } else {
        window.ContactsStore.update(editor.contact.id, patch);
      }
      close();
    };
    const del = () => {
      window.ContactsStore.remove(editor.contact.id);
      close();
    };

    return (
      <>
        <div style={{
          background: pal.card, border: `1px solid ${pal.border}`,
          borderRadius: 10, padding: 16,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: pal.text }}>{title || 'Contacts'}</h3>
            <span style={{
              fontSize: 11, fontWeight: 600, color: pal.textSoft,
              background: pal.chipBg, padding: '1px 7px', borderRadius: 10,
              fontVariantNumeric: 'tabular-nums',
            }}>{list.length}</span>
            <button onClick={openNew} style={{
              marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 9px', borderRadius: 6,
              background: pal.accentSoft, color: pal.accent,
              border: 'none', cursor: 'pointer',
              fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
            }}>
              <Icon name="plus" size={11} stroke={2.4} /> Add contact
            </button>
          </div>

          {list.length === 0 ? (
            <div style={{ fontSize: 12.5, color: pal.textFaint, fontStyle: 'italic' }}>
              No contacts yet. Click "Add contact" to start.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {list.map((c) => {
                // For a school view, surface a small hint if this contact came
                // from the parent district rather than the school itself.
                const fromDistrict = scope === 'school' && parentDistrictId &&
                  c.linkedTo.some((l) => l.type === 'district' && l.id === parentDistrictId) &&
                  !c.linkedTo.some((l) => l.type === 'school' && l.id === scopeId);
                return (
                  <div key={c.id} onClick={() => openEdit(c)} style={{
                    padding: '10px 12px',
                    background: pal.cardAlt,
                    border: `1px solid ${pal.borderSoft}`,
                    borderRadius: 7,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = pal.accent + '60'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = pal.borderSoft}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: pal.text }}>{c.name}</span>
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                        color: pal.textFaint,
                      }}>{c.role}</span>
                      {fromDistrict && (
                        <span style={{
                          fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4,
                          color: pal.accent, background: pal.accentSoft,
                          padding: '1px 6px', borderRadius: 3,
                        }}>DISTRICT-WIDE</span>
                      )}
                      {c.linkedTo.length > 1 && (
                        <span style={{
                          fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4,
                          color: pal.textSoft, background: pal.chipBg,
                          padding: '1px 6px', borderRadius: 3,
                        }}>×{c.linkedTo.length}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: pal.textSoft, marginTop: 4, flexWrap: 'wrap' }}>
                      {c.email && (
                        <a href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()}
                           style={{ color: pal.textSoft, textDecoration: 'none' }}>{c.email}</a>
                      )}
                      {c.phone && (
                        <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()}
                           style={{ color: pal.textSoft, textDecoration: 'none', fontVariantNumeric: 'tabular-nums' }}>{c.phone}</a>
                      )}
                    </div>
                    {c.linkedTo.length > 1 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        {c.linkedTo.map((l, i) => {
                          const col = linkBadgeColor(l.type, pal);
                          return (
                            <span key={i} style={{
                              fontSize: 10.5, fontWeight: 500,
                              padding: '2px 7px', borderRadius: 4,
                              background: col.bg, color: col.fg,
                            }}>{linkLabel(l)}</span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {editor && (
          <ContactEditor
            contact={editor.contact}
            isNew={editor.isNew}
            pal={pal}
            onSave={save}
            onDelete={del}
            onClose={close}
          />
        )}
      </>
    );
  }

  // ─── Editor modal ─────────────────────────────────────────────────────────
  function ContactEditor({ contact, isNew, pal, onSave, onDelete, onClose }) {
    const [draft, setDraft] = React.useState(contact);

    React.useEffect(() => {
      const onKey = (e) => { if (e.key === 'Escape') onClose(); };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    });

    const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
    const has = (type, id) => draft.linkedTo.some((l) => l.type === type && l.id === id);
    const toggle = (type, id) => {
      if (has(type, id)) {
        set({ linkedTo: draft.linkedTo.filter((l) => !(l.type === type && l.id === id)) });
      } else {
        set({ linkedTo: [...draft.linkedTo, { type, id }] });
      }
    };

    const handleSave = () => {
      if (!draft.name.trim() || draft.linkedTo.length === 0) return;
      onSave({ ...draft, name: draft.name.trim(), role: draft.role.trim() });
    };

    return (
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(16,18,22,.55)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40,
      }}>
        <div onClick={(e) => e.stopPropagation()} style={{
          background: pal.card, color: pal.text,
          borderRadius: 14,
          width: '100%', maxWidth: 560, maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 30px 80px rgba(0,0,0,.35), 0 0 0 1px ' + pal.border,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 20px',
            borderBottom: `1px solid ${pal.border}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
              color: pal.textFaint,
            }}>{isNew ? 'New contact' : 'Edit contact'}</div>
            <button onClick={onClose} style={{
              marginLeft: 'auto',
              border: 'none', background: 'transparent', color: pal.textSoft,
              fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: '2px 4px', borderRadius: 4,
            }}>×</button>
          </div>

          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
            <div>
              <Label pal={pal}>Name</Label>
              <Input pal={pal} value={draft.name} autoFocus
                     onChange={(v) => set({ name: v })} placeholder="Patricia Thompson" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <Label pal={pal}>Role</Label>
                <Input pal={pal} value={draft.role}
                       onChange={(v) => set({ role: v })} placeholder="Director of Special Ed" />
              </div>
              <div>
                <Label pal={pal}>Organization</Label>
                <Input pal={pal} value={draft.organization}
                       onChange={(v) => set({ organization: v })} placeholder="District / school" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <Label pal={pal}>Email</Label>
                <Input pal={pal} value={draft.email}
                       onChange={(v) => set({ email: v })} placeholder="name@district.k12.example" />
              </div>
              <div>
                <Label pal={pal}>Phone</Label>
                <Input pal={pal} value={draft.phone}
                       onChange={(v) => set({ phone: v })} placeholder="(555) 123-4567" />
              </div>
            </div>

            <LinkPicker pal={pal} draft={draft} toggle={toggle} />
          </div>

          <div style={{
            padding: '12px 20px',
            borderTop: `1px solid ${pal.border}`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {!isNew && (
              <button onClick={() => { if (confirm('Delete this contact?')) onDelete(); }}
                style={btnDanger(pal)}>Delete</button>
            )}
            <span style={{ flex: 1 }} />
            <button onClick={onClose} style={btnSecondary(pal)}>Cancel</button>
            <button onClick={handleSave}
              disabled={!draft.name.trim() || draft.linkedTo.length === 0}
              style={{
                ...btnPrimary(pal),
                opacity: (draft.name.trim() && draft.linkedTo.length > 0) ? 1 : 0.4,
              }}>
              {isNew ? 'Create contact' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Link picker (multi-select districts + schools) ───────────────────────
  function LinkPicker({ pal, draft, toggle }) {
    const [open, setOpen] = React.useState('districts');
    const [query, setQuery] = React.useState('');
    const districts = window.RCIS_DATA.DISTRICTS;
    const schools = window.RCIS_DATA.SCHOOLS;

    const districtMatches = React.useMemo(() => {
      const q = query.trim().toLowerCase();
      return districts.filter((d) => !q || d.name.toLowerCase().includes(q) || d.state.toLowerCase().includes(q));
    }, [query]);
    const schoolMatches = React.useMemo(() => {
      const q = query.trim().toLowerCase();
      return schools.filter((s) => !q || s.name.toLowerCase().includes(q) || s.districtName.toLowerCase().includes(q));
    }, [query]);

    const districtTags = draft.linkedTo.filter((l) => l.type === 'district');
    const schoolTags = draft.linkedTo.filter((l) => l.type === 'school');

    return (
      <div>
        <Label pal={pal}>
          Linked to <span style={{ textTransform: 'none', color: pal.textFaint, fontWeight: 500 }}>
            · {draft.linkedTo.length} {draft.linkedTo.length === 1 ? 'tag' : 'tags'}
            {draft.linkedTo.length === 0 && ' · required'}
          </span>
        </Label>

        {/* Currently-linked tags */}
        {draft.linkedTo.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
            {districtTags.map((l, i) => {
              const d = districts.find((x) => x.id === l.id);
              if (!d) return null;
              return (
                <span key={`d-${i}`} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 4px 3px 8px', borderRadius: 6,
                  background: pal.accentSoft, color: pal.accent,
                  fontSize: 11.5, fontWeight: 600,
                }}>
                  <span style={{ fontSize: 9, opacity: 0.7 }}>DIST</span>
                  {d.name}
                  <button onClick={() => toggle('district', l.id)} style={{
                    border: 'none', background: 'transparent', color: 'inherit',
                    cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '0 4px',
                  }}>×</button>
                </span>
              );
            })}
            {schoolTags.map((l, i) => {
              const s = schools.find((x) => x.id === l.id);
              if (!s) return null;
              return (
                <span key={`s-${i}`} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 4px 3px 8px', borderRadius: 6,
                  background: pal.chipBg, color: pal.text,
                  fontSize: 11.5, fontWeight: 600,
                }}>
                  <span style={{ fontSize: 9, opacity: 0.6, fontWeight: 700 }}>SCH</span>
                  {s.name}
                  <button onClick={() => toggle('school', l.id)} style={{
                    border: 'none', background: 'transparent', color: 'inherit',
                    cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '0 4px',
                  }}>×</button>
                </span>
              );
            })}
          </div>
        )}

        {/* Tab toggles */}
        <div style={{
          display: 'flex', gap: 4, marginBottom: 8,
          padding: 3, background: pal.cardAlt, borderRadius: 7, width: 'fit-content',
        }}>
          {[['districts', 'Districts'], ['schools', 'Schools']].map(([k, label]) => (
            <button key={k} onClick={() => setOpen(k)} style={{
              padding: '4px 14px', borderRadius: 5,
              border: 'none', cursor: 'pointer',
              background: open === k ? pal.card : 'transparent',
              color: open === k ? pal.text : pal.textSoft,
              fontSize: 12, fontWeight: open === k ? 600 : 500,
              fontFamily: 'inherit',
              boxShadow: open === k ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
            }}>{label}</button>
          ))}
        </div>

        <Input pal={pal} value={query} onChange={setQuery}
               placeholder={`Search ${open}…`} />

        <div style={{
          marginTop: 6, maxHeight: 180, overflowY: 'auto',
          background: pal.cardAlt, border: `1px solid ${pal.border}`, borderRadius: 7,
        }}>
          {open === 'districts' ? districtMatches.map((d) => {
            const on = draft.linkedTo.some((l) => l.type === 'district' && l.id === d.id);
            return (
              <PickerRow key={d.id} pal={pal} on={on}
                onClick={() => toggle('district', d.id)}
                title={d.name} sub={`${d.state} · ${d.schools} schools`} />
            );
          }) : schoolMatches.slice(0, 50).map((s) => {
            const on = draft.linkedTo.some((l) => l.type === 'school' && l.id === s.id);
            return (
              <PickerRow key={s.id} pal={pal} on={on}
                onClick={() => toggle('school', s.id)}
                title={s.name} sub={`${s.districtName} · ${s.state}`} />
            );
          })}
        </div>
      </div>
    );
  }

  function PickerRow({ pal, on, onClick, title, sub }) {
    return (
      <div onClick={onClick} style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '7px 11px',
        cursor: 'pointer',
        borderBottom: `1px solid ${pal.borderSoft}`,
        background: on ? pal.accentSoft : 'transparent',
      }}
      onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = pal.chipBg; }}
      onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
        <span style={{
          width: 14, height: 14, borderRadius: 3,
          border: `1.5px solid ${on ? pal.accent : pal.border}`,
          background: on ? pal.accent : 'transparent',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 9, flexShrink: 0,
        }}>{on ? '✓' : ''}</span>
        <span style={{ fontSize: 12.5, color: pal.text, fontWeight: on ? 600 : 500, flex: 1 }}>{title}</span>
        <span style={{ fontSize: 11, color: pal.textFaint }}>{sub}</span>
      </div>
    );
  }

  function Label({ pal, children }) {
    return (
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: 0.4,
        textTransform: 'uppercase', color: pal.textFaint, marginBottom: 5,
      }}>{children}</div>
    );
  }
  function Input({ pal, value, onChange, placeholder, autoFocus }) {
    return (
      <input value={value} autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '8px 11px',
          fontSize: 13, color: pal.text,
          background: pal.cardAlt,
          border: `1px solid ${pal.border}`, borderRadius: 7,
          outline: 'none', fontFamily: 'inherit',
        }} />
    );
  }
  function btnPrimary(pal) {
    return { padding: '8px 16px', background: pal.accent, color: '#fff', border: 'none',
      borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
  }
  function btnSecondary(pal) {
    return { padding: '8px 14px', background: 'transparent', color: pal.textSoft,
      border: `1px solid ${pal.border}`, borderRadius: 7, fontSize: 13, fontWeight: 500,
      cursor: 'pointer', fontFamily: 'inherit' };
  }
  function btnDanger(pal) {
    return { padding: '8px 14px', background: 'transparent', color: pal.warn,
      border: `1px solid ${pal.border}`, borderRadius: 7, fontSize: 13, fontWeight: 500,
      cursor: 'pointer', fontFamily: 'inherit' };
  }

  window.ContactsSection = ContactsSection;
  window.ContactEditor = ContactEditor;
})();
