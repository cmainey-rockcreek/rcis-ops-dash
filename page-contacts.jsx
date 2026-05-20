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
              rows.map((c) => <ContactRow key={c.id} c={c} pal={pal} onClick={() => openEdit(c)} />)
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

  window.ContactsPage = ContactsPage;
})();
