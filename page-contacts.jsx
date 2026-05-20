// Global Contacts page — search across every contact, see all their tags,
// click into the linked district/school. Add new contacts from here too.

(function () {
  const { Icon } = window;

  function ContactsPage({ dark = false }) {
    return (
      <window.PageShell dark={dark} activePage="contacts"
                        searchPlaceholder="Search contacts by name, role, organization…">
        {(pal) => <ContactsList pal={pal} />}
      </window.PageShell>
    );
  }

  function ContactsList({ pal }) {
    const contacts = window.useContacts();
    const [query, setQuery] = React.useState('');
    const [scopeFilter, setScopeFilter] = React.useState('all'); // 'all'|'district'|'school'|'multi'
    const [editor, setEditor] = React.useState(null);

    const rows = React.useMemo(() => {
      const q = query.trim().toLowerCase();
      return contacts
        .filter((c) => {
          if (scopeFilter === 'district') return c.linkedTo.some((l) => l.type === 'district');
          if (scopeFilter === 'school')   return c.linkedTo.some((l) => l.type === 'school');
          if (scopeFilter === 'multi')    return c.linkedTo.length > 1;
          return true;
        })
        .filter((c) => {
          if (!q) return true;
          return (
            c.name.toLowerCase().includes(q) ||
            c.role.toLowerCase().includes(q) ||
            (c.organization || '').toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q)
          );
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    }, [contacts, query, scopeFilter]);

    const counts = React.useMemo(() => ({
      all: contacts.length,
      district: contacts.filter((c) => c.linkedTo.some((l) => l.type === 'district')).length,
      school:   contacts.filter((c) => c.linkedTo.some((l) => l.type === 'school')).length,
      multi:    contacts.filter((c) => c.linkedTo.length > 1).length,
    }), [contacts]);

    const SCOPE_OPTS = [
      { key: 'all',      label: 'All',         count: counts.all },
      { key: 'district', label: 'District',    count: counts.district },
      { key: 'school',   label: 'School',      count: counts.school },
      { key: 'multi',    label: 'Multi-tagged', count: counts.multi },
    ];

    const openNew = () => setEditor({
      contact: { id: null, name: '', role: '', email: '', phone: '', organization: '', linkedTo: [] },
      isNew: true,
    });
    const openEdit = (c) => setEditor({ contact: { ...c, linkedTo: [...c.linkedTo] }, isNew: false });
    const close = () => setEditor(null);
    const save = async (patch) => {
      if (editor.isNew) {
        const { id, ...rest } = patch;
        const created = await window.ContactsStore.add(rest);
        close();
        if (created && created.id) window.navigate(`/contacts/${created.id}`);
      } else {
        window.ContactsStore.update(editor.contact.id, patch);
        close();
      }
    };
    const del = () => {
      window.ContactsStore.remove(editor.contact.id);
      close();
    };

    return (
      <div style={{
        flex: 1, padding: '20px 24px',
        display: 'flex', flexDirection: 'column', gap: 14,
        overflow: 'hidden',
        minHeight: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: pal.text, letterSpacing: -0.3 }}>Contacts</h1>
          <span style={{ fontSize: 13, color: pal.textSoft }}>{rows.length} of {contacts.length}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={openNew} style={btnPrimary(pal)}>
              <Icon name="plus" size={13} stroke={2.4} /> New contact
            </button>
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px',
          background: pal.card, border: `1px solid ${pal.border}`, borderRadius: 9,
          flexShrink: 0,
        }}>
          <Icon name="search" size={15} color={pal.textFaint} stroke={1.8} />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
                 placeholder="Search by name, role, organization, email…"
                 style={{
                   flex: 1, border: 'none', outline: 'none',
                   background: 'transparent', color: pal.text,
                   fontSize: 13, fontFamily: 'inherit',
                 }} />
          {query && (
            <button onClick={() => setQuery('')} style={{
              border: 'none', background: 'transparent', color: pal.textFaint,
              cursor: 'pointer', fontSize: 14, padding: '0 4px',
            }}>×</button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {SCOPE_OPTS.map((opt) => {
            const on = scopeFilter === opt.key;
            return (
              <button key={opt.key} onClick={() => setScopeFilter(opt.key)} style={{
                padding: '4px 10px', borderRadius: 999,
                border: `1px solid ${on ? pal.accent : pal.border}`,
                background: on ? pal.accentSoft : 'transparent',
                color: on ? pal.accent : pal.textSoft,
                fontSize: 11.5, fontWeight: on ? 600 : 500,
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                {opt.label}
                <span style={{ fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  color: on ? pal.accent : pal.textFaint }}>{opt.count}</span>
              </button>
            );
          })}
        </div>

        {/* List — its own scroll container so header + filters stay pinned
            while you page through long contact lists. */}
        <div style={{
          background: pal.card, border: `1px solid ${pal.border}`,
          borderRadius: 10,
          flex: 1, minHeight: 0,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {rows.length === 0 ? (
              <div style={{ padding: '40px 14px', textAlign: 'center',
                color: pal.textFaint, fontSize: 13 }}>
                No contacts match.
              </div>
            ) : (
              rows.map((c) => <ContactRow key={c.id} c={c} pal={pal} onClick={() => window.navigate(`/contacts/${c.id}`)} />)
            )}
          </div>
        </div>

        {editor && (
          <window.ContactEditor
            contact={editor.contact} isNew={editor.isNew}
            pal={pal} onSave={save} onDelete={del} onClose={close}
          />
        )}
      </div>
    );
  }

  function ContactRow({ c, pal, onClick }) {
    const initials = c.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
    return (
      <div onClick={onClick} style={{
        display: 'grid',
        gridTemplateColumns: '32px 1.6fr 1.4fr 1.6fr 1.6fr',
        gap: 12, alignItems: 'center',
        padding: '12px 14px',
        borderBottom: `1px solid ${pal.borderSoft}`,
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = pal.cardAlt}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <span style={{
          width: 32, height: 32, borderRadius: 16,
          background: pal.chipBg, color: pal.text,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11.5, fontWeight: 700, letterSpacing: 0.3,
        }}>{initials}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: pal.text, fontWeight: 600,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
          <div style={{ fontSize: 11, color: pal.textFaint, marginTop: 1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.role}</div>
        </div>
        <div style={{ minWidth: 0 }}>
          <a href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()}
             style={{ fontSize: 12, color: pal.textSoft, textDecoration: 'none',
               display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</a>
          <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()}
             style={{ fontSize: 11, color: pal.textFaint, textDecoration: 'none',
               fontVariantNumeric: 'tabular-nums', marginTop: 2, display: 'block' }}>{c.phone}</a>
        </div>
        <div style={{ fontSize: 12, color: pal.textSoft, minWidth: 0,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.organization}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minWidth: 0 }}>
          {c.linkedTo.slice(0, 4).map((l, i) => {
            const isDist = l.type === 'district';
            const target = isDist
              ? window.RCIS_DATA.DISTRICTS.find((x) => x.id === l.id)
              : window.RCIS_DATA.SCHOOLS.find((x) => x.id === l.id);
            if (!target) return null;
            return (
              <window.Link key={i} to={`/${isDist ? 'districts' : 'schools'}/${l.id}`}
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 7px', borderRadius: 4,
                  background: isDist ? pal.accentSoft : pal.chipBg,
                  color: isDist ? pal.accent : pal.text,
                  fontSize: 10.5, fontWeight: 500, textDecoration: 'none',
                }}>
                <span style={{ fontSize: 8.5, fontWeight: 800, opacity: 0.6, letterSpacing: 0.3 }}>{isDist ? 'DIST' : 'SCH'}</span>
                <span style={{ whiteSpace: 'nowrap' }}>{target.name}</span>
              </window.Link>
            );
          })}
          {c.linkedTo.length > 4 && (
            <span style={{ fontSize: 10.5, color: pal.textFaint, fontWeight: 600 }}>+{c.linkedTo.length - 4}</span>
          )}
        </div>
      </div>
    );
  }

  function btnPrimary(pal) {
    return {
      height: 30, padding: '0 12px', borderRadius: 7,
      background: pal.accent, color: '#fff', border: 'none',
      fontSize: 12.5, fontWeight: 600,
      display: 'inline-flex', alignItems: 'center', gap: 5,
      cursor: 'pointer', fontFamily: 'inherit',
    };
  }
  function btnSecondary(pal) {
    return {
      height: 30, padding: '0 12px', borderRadius: 7,
      background: 'transparent', color: pal.textSoft,
      border: `1px solid ${pal.border}`,
      fontSize: 12.5, fontWeight: 500,
      display: 'inline-flex', alignItems: 'center', gap: 5,
      cursor: 'pointer', fontFamily: 'inherit',
    };
  }

  // ─── Contact detail page ─────────────────────────────────────────────────
  function ContactDetailPage({ dark = false, id }) {
    return (
      <window.PageShell dark={dark} activePage="contacts">
        {(pal) => <ContactDetail pal={pal} id={id} />}
      </window.PageShell>
    );
  }

  function ContactDetail({ pal, id }) {
    const contacts = window.useContacts();
    const c = contacts.find((x) => x.id === id);

    if (!c) {
      return (
        <div style={{ flex: 1, padding: 40, color: pal.textSoft }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: pal.text }}>Contact not found</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>No contact with id <code>{id}</code>.</div>
          <window.Link to="/contacts" style={{ color: pal.accent, fontWeight: 500, marginTop: 12, display: 'inline-block' }}>← Back to contacts</window.Link>
        </div>
      );
    }

    const updateField = (patch) => window.ContactsStore.update(c.id, patch);

    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Crumb */}
        <div style={{
          padding: '14px 24px 0', display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: pal.textSoft,
        }}>
          <window.Link to="/contacts" style={{ color: pal.textSoft, textDecoration: 'none', fontWeight: 500 }}>
            ← Contacts
          </window.Link>
          <span style={{ color: pal.textFaint }}>/</span>
          <span style={{ color: pal.text, fontWeight: 500 }}>{c.name}</span>
        </div>

        <ContactHeader c={c} pal={pal} onUpdate={updateField} />

        <div style={{
          padding: '0 24px 32px',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)',
          gap: 16,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <OrganizationsCard c={c} pal={pal} onUpdate={updateField} />
            <ContactLinkedTasksCard c={c} pal={pal} />
            <ContactNotesCard c={c} pal={pal} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <SiblingContactsCard c={c} contacts={contacts} pal={pal} />
            <ContactDocumentsCard c={c} pal={pal} />
          </div>
        </div>
      </div>
    );
  }

  // ─── Editable contact header ─────────────────────────────────────────────
  function ContactHeader({ c, pal, onUpdate }) {
    const initials = c.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
    return (
      <div style={{ padding: '14px 24px 4px', display: 'flex', alignItems: 'flex-start', gap: 18 }}>
        <span style={{
          width: 54, height: 54, borderRadius: 27,
          background: pal.chipBg, color: pal.text,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 700, letterSpacing: 0.3, flexShrink: 0,
        }}>{initials || '·'}</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <ContactEditableHeading pal={pal} value={c.name}
              fontSize={22} fontWeight={600} placeholder="Unnamed contact"
              onSave={(v) => onUpdate({ name: v })} requireNonEmpty />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <ContactEditableHeading pal={pal} value={c.role}
              fontSize={13} fontWeight={500} placeholder="Add role / title"
              softColor onSave={(v) => onUpdate({ role: v })} />
            {c.organization ? (
              <>
                <span style={{ color: pal.textFaint, fontSize: 12 }}>·</span>
                <ContactEditableHeading pal={pal} value={c.organization}
                  fontSize={13} fontWeight={500} placeholder="Add organization"
                  softColor onSave={(v) => onUpdate({ organization: v })} />
              </>
            ) : (
              <>
                <span style={{ color: pal.textFaint, fontSize: 12 }}>·</span>
                <ContactEditableHeading pal={pal} value="" fontSize={13} fontWeight={500}
                  placeholder="Add organization" softColor
                  onSave={(v) => onUpdate({ organization: v })} />
              </>
            )}
          </div>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 18,
            marginTop: 10, fontSize: 12.5, color: pal.textSoft,
          }}>
            <ContactEditableField pal={pal} icon="user" placeholder="Add email"
              value={c.email} mailto onSave={(v) => onUpdate({ email: v })} />
            <ContactEditableField pal={pal} icon="user" placeholder="Add phone"
              value={c.phone} tel onSave={(v) => onUpdate({ phone: v })} />
          </div>
        </div>
      </div>
    );
  }

  // Heading-style editable text (name / role / org line).
  function ContactEditableHeading({ pal, value, fontSize, fontWeight, placeholder, onSave, requireNonEmpty, softColor }) {
    const [editing, setEditing] = React.useState(false);
    const [draft, setDraft] = React.useState(value || '');
    const inputRef = React.useRef(null);
    React.useEffect(() => {
      if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
    }, [editing]);

    const startEdit = () => { setDraft(value || ''); setEditing(true); };
    const commit = () => {
      const next = draft.trim();
      if (requireNonEmpty && !next) { setEditing(false); return; }
      if (next !== (value || '').trim()) onSave(next);
      setEditing(false);
    };
    const cancel = () => { setDraft(value || ''); setEditing(false); };
    const onKey = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    };
    if (editing) {
      return (
        <input ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
          placeholder={placeholder}
          style={{
            margin: 0, padding: '2px 6px',
            fontSize, fontWeight, color: pal.text,
            letterSpacing: fontSize >= 20 ? -0.3 : 0,
            background: pal.cardAlt,
            border: `1px solid ${pal.accent}`, borderRadius: 6,
            outline: 'none', fontFamily: 'inherit',
            minWidth: fontSize >= 20 ? 260 : 160,
          }}
        />
      );
    }
    const display = value && value.trim().length > 0;
    const baseStyle = {
      margin: 0,
      fontSize, fontWeight,
      color: softColor ? pal.textSoft : pal.text,
      letterSpacing: fontSize >= 20 ? -0.3 : 0,
      cursor: 'pointer',
      borderBottom: '1px dashed transparent',
      paddingBottom: 1,
    };
    return (
      <span onClick={startEdit}
        title="Click to edit"
        style={baseStyle}
        onMouseEnter={(e) => e.currentTarget.style.borderBottomColor = pal.borderSoft}
        onMouseLeave={(e) => e.currentTarget.style.borderBottomColor = 'transparent'}>
        {display ? value : <span style={{ color: pal.textFaint, fontStyle: 'italic' }}>{placeholder}</span>}
      </span>
    );
  }

  // Email/phone editable field with optional mailto/tel link mode.
  function ContactEditableField({ pal, icon, value, placeholder, onSave, mailto, tel }) {
    const [editing, setEditing] = React.useState(false);
    const [draft, setDraft] = React.useState(value || '');
    const inputRef = React.useRef(null);
    const Icon = window.Icon;
    React.useEffect(() => {
      if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
    }, [editing]);

    const startEdit = () => { setDraft(value || ''); setEditing(true); };
    const commit = () => {
      const next = draft.trim();
      if (next !== (value || '').trim()) onSave(next || null);
      setEditing(false);
    };
    const cancel = () => { setDraft(value || ''); setEditing(false); };
    const onKey = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    };

    if (editing) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {icon && <Icon name={icon} size={12} stroke={1.8} />}
          <input ref={inputRef}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={onKey}
            style={{
              padding: '1px 5px',
              fontSize: 12.5, color: pal.text,
              background: pal.cardAlt,
              border: `1px solid ${pal.accent}`, borderRadius: 4,
              outline: 'none', fontFamily: 'inherit',
              minWidth: 160,
            }}
          />
        </span>
      );
    }
    const display = value && value.trim().length > 0;
    const linkHref = display
      ? (mailto ? `mailto:${value}` : tel ? `tel:${value}` : null)
      : null;
    return (
      <span
        title="Click to edit"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          borderBottom: '1px dashed transparent',
          paddingBottom: 1,
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderBottomColor = pal.borderSoft}
        onMouseLeave={(e) => e.currentTarget.style.borderBottomColor = 'transparent'}>
        {icon && (
          <span onClick={startEdit} style={{ cursor: 'pointer', display: 'inline-flex' }}>
            <Icon name={icon} size={12} stroke={1.8} />
          </span>
        )}
        <span onClick={startEdit} style={{
          cursor: 'pointer',
          color: display ? 'inherit' : pal.textFaint,
          fontStyle: display ? 'normal' : 'italic',
        }}>
          {display ? value : placeholder}
        </span>
        {linkHref && (
          <a href={linkHref}
            onClick={(e) => e.stopPropagation()}
            title={mailto ? 'Send email' : 'Call'}
            style={{
              display: 'inline-flex', alignItems: 'center',
              color: pal.textFaint, textDecoration: 'none',
              fontSize: 10, lineHeight: 1,
              padding: '1px 3px', borderRadius: 3,
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = pal.accent}
            onMouseLeave={(e) => e.currentTarget.style.color = pal.textFaint}>↗</a>
        )}
      </span>
    );
  }

  // ─── Section helper (shared) ─────────────────────────────────────────────
  function ContactSection({ pal, title, badge, action, children }) {
    return (
      <div style={{
        background: pal.card, border: `1px solid ${pal.border}`,
        borderRadius: 10, padding: 16,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: pal.text }}>{title}</h3>
          {badge != null && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: pal.textSoft,
              background: pal.chipBg, padding: '1px 7px', borderRadius: 10,
              fontVariantNumeric: 'tabular-nums',
            }}>{badge}</span>
          )}
          {action && <span style={{ marginLeft: 'auto' }}>{action}</span>}
        </div>
        {children}
      </div>
    );
  }

  // ─── Organizations card ──────────────────────────────────────────────────
  function OrganizationsCard({ c, pal, onUpdate }) {
    const [picking, setPicking] = React.useState(false);
    const DISTRICTS = window.RCIS_DATA.DISTRICTS;
    const SCHOOLS   = window.RCIS_DATA.SCHOOLS;
    const has = (type, id) => c.linkedTo.some((l) => l.type === type && l.id === id);
    const toggle = (type, id) => {
      const next = has(type, id)
        ? c.linkedTo.filter((l) => !(l.type === type && l.id === id))
        : [...c.linkedTo, { type, id }];
      onUpdate({ linkedTo: next });
    };
    const remove = (type, id) => {
      onUpdate({ linkedTo: c.linkedTo.filter((l) => !(l.type === type && l.id === id)) });
    };

    const action = (
      <button onClick={() => setPicking((v) => !v)} style={{
        background: 'transparent', border: 'none',
        color: pal.accent, fontSize: 12, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit', padding: 0,
      }}>{picking ? 'Done' : '+ Edit links'}</button>
    );

    return (
      <ContactSection pal={pal} title="Organizations" badge={c.linkedTo.length} action={action}>
        {c.linkedTo.length === 0 && !picking && (
          <div style={{ fontSize: 12, color: pal.textFaint, fontStyle: 'italic' }}>
            Not linked to any district or school yet.
          </div>
        )}
        {!picking && c.linkedTo.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {c.linkedTo.map((l, i) => {
              const target = l.type === 'district'
                ? DISTRICTS.find((d) => d.id === l.id)
                : SCHOOLS.find((s) => s.id === l.id);
              if (!target) return null;
              const isDist = l.type === 'district';
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px',
                  background: pal.cardAlt,
                  border: `1px solid ${pal.borderSoft}`,
                  borderRadius: 7,
                }}>
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: 0.6,
                    padding: '3px 6px', borderRadius: 4,
                    background: isDist ? pal.accent + '22' : '#E76B5D22',
                    color: isDist ? pal.accent : '#E76B5D',
                  }}>{isDist ? 'DIST' : 'SCH'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <window.Link to={`/${isDist ? 'districts' : 'schools'}/${l.id}`}
                      style={{
                        fontSize: 13, color: pal.text, fontWeight: 500,
                        textDecoration: 'none',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        display: 'block',
                      }}>{target.name}</window.Link>
                    <div style={{ fontSize: 11, color: pal.textFaint, marginTop: 1 }}>
                      {target.state}{isDist ? '' : ` · ${(DISTRICTS.find((d) => d.id === target.district) || {}).name || ''}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {picking && (
          <OrgPicker pal={pal} draft={c} has={has} toggle={toggle} />
        )}
      </ContactSection>
    );
  }

  // Inline org picker (used inside OrganizationsCard when editing).
  function OrgPicker({ pal, draft, has, toggle }) {
    const [q, setQ] = React.useState('');
    const DISTRICTS = window.RCIS_DATA.DISTRICTS;
    const SCHOOLS   = window.RCIS_DATA.SCHOOLS;
    const query = q.trim().toLowerCase();
    const match = (s) => !query || (s || '').toLowerCase().includes(query);

    const dists  = DISTRICTS.filter((d) => match(d.name) || match(d.state));
    const schls  = SCHOOLS  .filter((s) => match(s.name) || match(s.state));

    const Row = ({ type, id, name, sub }) => {
      const on = has(type, id);
      return (
        <div onClick={() => toggle(type, id)} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px',
          borderBottom: `1px solid ${pal.borderSoft}`,
          cursor: 'pointer',
          background: on ? pal.chipBg : 'transparent',
        }}>
          <span style={{
            width: 14, height: 14, borderRadius: 3,
            border: `1px solid ${on ? pal.accent : pal.border}`,
            background: on ? pal.accent : 'transparent',
            flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 10, fontWeight: 700,
          }}>{on ? '✓' : ''}</span>
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
            padding: '2px 5px', borderRadius: 3,
            background: type === 'district' ? pal.accent + '22' : '#E76B5D22',
            color: type === 'district' ? pal.accent : '#E76B5D',
            flexShrink: 0,
          }}>{type === 'district' ? 'DIST' : 'SCH'}</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: pal.text, fontWeight: 500,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
          <span style={{ fontSize: 11, color: pal.textFaint, flexShrink: 0 }}>{sub}</span>
        </div>
      );
    };

    return (
      <div>
        <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus
          placeholder="Search district or school…"
          style={{
            width: '100%', padding: '7px 10px', marginBottom: 6,
            fontSize: 12.5, color: pal.text,
            background: pal.cardAlt, border: `1px solid ${pal.border}`, borderRadius: 6,
            outline: 'none', fontFamily: 'inherit',
          }} />
        <div style={{
          maxHeight: 280, overflowY: 'auto',
          background: pal.cardAlt, border: `1px solid ${pal.border}`, borderRadius: 6,
        }}>
          {dists.slice(0, 12).map((d) => (
            <Row key={'d-' + d.id} type="district" id={d.id} name={d.name} sub={d.state} />
          ))}
          {schls.slice(0, 12).map((s) => {
            const distName = (DISTRICTS.find((d) => d.id === s.district) || {}).name || '';
            return <Row key={'s-' + s.id} type="school" id={s.id} name={s.name} sub={`${distName} · ${s.state}`} />;
          })}
          {dists.length === 0 && schls.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 12.5, color: pal.textFaint }}>No matches.</div>
          )}
        </div>
      </div>
    );
  }

  // ─── Linked tasks ────────────────────────────────────────────────────────
  function ContactLinkedTasksCard({ c, pal }) {
    const todos = window.useTodos ? window.useTodos() : [];
    const linked = React.useMemo(
      () => todos.filter((t) => t.linkedTo && t.linkedTo.type === 'contact' && t.linkedTo.id === c.id),
      [todos, c.id],
    );
    const open = linked.filter((t) => t.column !== 'done');
    const done = linked.filter((t) => t.column === 'done');

    return (
      <ContactSection pal={pal} title="Open tasks" badge={open.length}>
        {open.length === 0 && (
          <div style={{ fontSize: 12, color: pal.textFaint, fontStyle: 'italic' }}>
            No tasks tagged to {c.name.split(' ')[0] || 'this contact'} yet.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {open.map((t) => <ContactMiniTodo key={t.id} t={t} pal={pal} />)}
        </div>
        {done.length > 0 && (
          <details style={{ marginTop: 4 }}>
            <summary style={{ fontSize: 11.5, color: pal.textSoft, cursor: 'pointer' }}>
              Show {done.length} completed
            </summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {done.map((t) => <ContactMiniTodo key={t.id} t={t} pal={pal} faded />)}
            </div>
          </details>
        )}
      </ContactSection>
    );
  }

  function ContactMiniTodo({ t, pal, faded }) {
    const PRIO = { high: '#D97757', medium: '#C98A2C', low: '#7A8290' };
    return (
      <div style={{
        padding: '8px 10px',
        background: pal.cardAlt,
        border: `1px solid ${pal.borderSoft}`,
        borderLeft: `3px solid ${PRIO[t.priority] || pal.textSoft}`,
        borderRadius: 6,
        opacity: faded ? 0.6 : 1,
      }}>
        <div style={{ fontSize: 12.5, color: pal.text, fontWeight: 500,
          textDecoration: t.column === 'done' ? 'line-through' : 'none' }}>{t.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, fontSize: 10.5 }}>
          <span style={{ fontWeight: 600, color: pal.textSoft, padding: '1px 6px', borderRadius: 3, background: pal.chipBg }}>{t.label}</span>
          <span style={{ fontWeight: 600, color: pal.textFaint, textTransform: 'capitalize' }}>{t.column}</span>
        </div>
      </div>
    );
  }

  // ─── Sibling contacts (also at same org) ─────────────────────────────────
  function SiblingContactsCard({ c, contacts, pal }) {
    const siblings = React.useMemo(() => {
      if (!c.linkedTo || c.linkedTo.length === 0) return [];
      const myKeys = new Set(c.linkedTo.map((l) => `${l.type}:${l.id}`));
      return contacts
        .filter((x) => x.id !== c.id && x.linkedTo.some((l) => myKeys.has(`${l.type}:${l.id}`)))
        .slice(0, 8);
    }, [c, contacts]);

    return (
      <ContactSection pal={pal} title="Also at same org" badge={siblings.length}>
        {siblings.length === 0 && (
          <div style={{ fontSize: 12, color: pal.textFaint, fontStyle: 'italic' }}>
            No other contacts share an organization yet.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {siblings.map((s) => (
            <window.Link key={s.id} to={`/contacts/${s.id}`} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 10px',
              background: pal.cardAlt,
              border: `1px solid ${pal.borderSoft}`, borderRadius: 7,
              textDecoration: 'none', color: 'inherit',
            }}>
              <span style={{
                width: 26, height: 26, borderRadius: 13,
                background: pal.chipBg, color: pal.text,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10.5, fontWeight: 700, flexShrink: 0,
              }}>{s.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: pal.text, fontWeight: 600,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                <div style={{ fontSize: 10.5, color: pal.textFaint, marginTop: 1,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.role || '—'}</div>
              </div>
            </window.Link>
          ))}
        </div>
      </ContactSection>
    );
  }

  // ─── Notes (reuses shared NotesSection with scope='contact') ─────────────
  function ContactNotesCard({ c, pal }) {
    if (!window.NotesSection) return null;
    return <window.NotesSection pal={pal} scope="contact" scopeId={c.id}
      placeholder={`Anything worth remembering about ${c.name.split(' ')[0] || 'this contact'} — preferences, best times, history…`} />;
  }

  // ─── Documents (reuses DocumentsStore with scope='contact') ──────────────
  function ContactDocumentsCard({ c, pal }) {
    const helpers = window.attachmentHelpers || {};
    const docs = window.useDocuments ? window.useDocuments('contact', c.id) : [];
    const sorted = React.useMemo(() => [...docs].sort((a, b) => b.addedAt - a.addedAt), [docs]);
    const [adding, setAdding] = React.useState(false);
    const [url, setUrl] = React.useState('');
    const [name, setName] = React.useState('');
    const [uploading, setUploading] = React.useState(null);
    const [error, setError] = React.useState(null);
    const fileInputRef = React.useRef(null);
    const Icon = window.Icon;
    const KIND_META = helpers.KIND_META || {};

    const resetLink = () => { setAdding(false); setUrl(''); setName(''); };
    const commitLink = async () => {
      const trimmed = url.trim();
      if (!trimmed) return;
      const finalName = name.trim() || (helpers.defaultAttachmentName ? helpers.defaultAttachmentName(trimmed) : trimmed);
      const kind = helpers.detectAttachmentKind ? helpers.detectAttachmentKind(trimmed, finalName) : 'link';
      await window.DocumentsStore.add({ scope: 'contact', scopeId: c.id, kind, url: trimmed, name: finalName });
      resetLink();
    };
    const triggerFilePicker = () => {
      setError(null);
      if (fileInputRef.current) fileInputRef.current.click();
    };
    const onFileSelected = async (event) => {
      const file = event.target.files && event.target.files[0];
      event.target.value = '';
      if (!file) return;
      setUploading(file.name);
      setError(null);
      try {
        await window.DocumentsStore.addUpload({ scope: 'contact', scopeId: c.id, file });
      } catch (err) {
        console.warn('contact doc upload failed', err);
        setError((err && err.message) ? err.message : 'Upload failed.');
      } finally { setUploading(null); }
    };
    const removeDoc = async (d) => {
      if (!confirm(`Delete "${d.name}"?`)) return;
      await window.DocumentsStore.remove(d.id);
    };

    const actionBtn = (
      <button onClick={triggerFilePicker} disabled={!!uploading} style={{
        background: 'transparent', border: 'none',
        color: pal.accent, fontSize: 12, fontWeight: 600,
        cursor: uploading ? 'default' : 'pointer', fontFamily: 'inherit', padding: 0,
      }}>{uploading ? `Uploading…` : '+ Upload'}</button>
    );

    return (
      <ContactSection pal={pal} title="Documents" badge={sorted.length} action={actionBtn}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sorted.length === 0 && !adding && (
            <div style={{ fontSize: 12, color: pal.textFaint, fontStyle: 'italic' }}>
              No documents yet.
            </div>
          )}
          {sorted.map((d) => {
            const meta = KIND_META[d.kind] || { abbr: 'FILE', full: 'File', color: pal.textSoft };
            const open = (e) => { e.preventDefault(); window.DocumentsStore.open(d); };
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
                  background: meta.color + '20', color: meta.color,
                  fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6,
                  borderRadius: 4, fontFamily: 'ui-monospace, monospace',
                }}>{meta.abbr}</span>
                <a href={d.url || '#'} onClick={open} style={{
                  flex: 1, fontSize: 12.5, color: pal.text, fontWeight: 500,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{d.name}</a>
                <button onClick={() => removeDoc(d)} title="Delete"
                  style={{
                    border: 'none', background: 'transparent',
                    color: pal.textFaint, fontSize: 16, lineHeight: 1,
                    cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
                  }}>×</button>
              </div>
            );
          })}
          {adding ? (
            <div style={{
              padding: 10, background: pal.cardAlt,
              border: `1px dashed ${pal.border}`, borderRadius: 7,
              display: 'flex', flexDirection: 'column', gap: 7,
            }}>
              <input autoFocus
                placeholder="Paste URL — Google Doc, Drive, share link…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitLink(); } if (e.key === 'Escape') resetLink(); }}
                style={{
                  width: '100%', padding: '7px 10px',
                  fontSize: 12.5, color: pal.text, background: pal.card,
                  border: `1px solid ${pal.border}`, borderRadius: 6,
                  outline: 'none', fontFamily: 'inherit',
                }} />
              <div style={{ display: 'flex', gap: 7 }}>
                <input placeholder="Display name (optional)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    flex: 1, padding: '7px 10px',
                    fontSize: 12.5, color: pal.text, background: pal.card,
                    border: `1px solid ${pal.border}`, borderRadius: 6,
                    outline: 'none', fontFamily: 'inherit',
                  }} />
                <button onClick={resetLink} style={{
                  padding: '0 12px', background: 'transparent', color: pal.textSoft,
                  border: `1px solid ${pal.border}`, borderRadius: 6,
                  fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                }}>Cancel</button>
                <button onClick={commitLink} disabled={!url.trim()} style={{
                  padding: '0 14px',
                  background: url.trim() ? pal.accent : pal.chipBg,
                  color: url.trim() ? '#fff' : pal.textFaint,
                  border: 'none', borderRadius: 6,
                  fontSize: 12, fontWeight: 600,
                  cursor: url.trim() ? 'pointer' : 'default', fontFamily: 'inherit',
                }}>Add link</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} style={{
              padding: '6px 10px',
              background: 'transparent', color: pal.textSoft,
              border: `1px dashed ${pal.border}`, borderRadius: 7,
              fontSize: 11.5, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>+ Add link instead</button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={helpers.UPLOAD_ACCEPT || '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt'}
            onChange={onFileSelected}
            style={{ display: 'none' }}
          />
          {error && (
            <div style={{
              fontSize: 11.5, color: pal.warn,
              padding: '6px 10px',
              border: `1px solid ${pal.warn}`, borderRadius: 6, marginTop: 2,
            }}>{error}</div>
          )}
        </div>
      </ContactSection>
    );
  }

  window.ContactsPage = ContactsPage;
  window.ContactDetailPage = ContactDetailPage;
})();
