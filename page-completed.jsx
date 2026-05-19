// CompletedPage — archive view of all done tasks.
// Filters by owner, category, date range, and free-text search. Click a row
// to open it in the TodoEditor; from there a task can be reopened (moved
// back to To do / Doing) if it wasn't actually finished.

(function () {
  const { OwnerAvatar, Icon, teamMember } = window;

  const DEFAULT_FILTERS = {
    q: '',
    owner: 'all',
    label: 'all',
    range: '30',
  };

  function CompletedPage({ dark = false }) {
    return (
      <window.PageShell dark={dark} activePage="completed" searchPlaceholder="Search completed tasks">
        {(pal) => <CompletedWorkspace pal={pal} />}
      </window.PageShell>
    );
  }

  function CompletedWorkspace({ pal }) {
    const todos = window.useTodos();
    const team = window.useTeam ? window.useTeam() : window.RCIS_DATA.TEAM;
    const [editor, setEditor] = React.useState(null);
    const [filters, setFilters] = React.useState(DEFAULT_FILTERS);

    const done = React.useMemo(() => todos.filter((t) => t.column === 'done'), [todos]);

    const filtered = React.useMemo(() => {
      const cutoff = filters.range === 'all'
        ? null
        : Date.now() - parseInt(filters.range, 10) * 24 * 60 * 60 * 1000;
      const q = filters.q.trim().toLowerCase();

      return done
        .filter((t) => {
          if (cutoff && (t.completedAt || t.updatedAt || 0) < cutoff) return false;
          if (filters.owner === 'unassigned' && t.owners.length > 0) return false;
          if (filters.owner !== 'all' && filters.owner !== 'unassigned' && !t.owners.includes(filters.owner)) return false;
          if (filters.label !== 'all' && t.label !== filters.label) return false;
          if (q) {
            const haystack = [
              t.title, t.notes, t.label,
              t.linkedTo && t.linkedTo.name,
              ...(t.owners || []).map((id) => teamMember(id).name),
            ].filter(Boolean).join(' ').toLowerCase();
            if (!haystack.includes(q)) return false;
          }
          return true;
        })
        .sort((a, b) => (b.completedAt || b.updatedAt || 0) - (a.completedAt || a.updatedAt || 0));
    }, [done, filters]);

    const counts = React.useMemo(() => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      return {
        total: done.length,
        last7: done.filter((t) => (t.completedAt || t.updatedAt || 0) >= now - 7 * day).length,
        last30: done.filter((t) => (t.completedAt || t.updatedAt || 0) >= now - 30 * day).length,
      };
    }, [done]);

    const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
    const clearFilters = () => setFilters(DEFAULT_FILTERS);

    const openEdit = (todo) => setEditor({ isNew: false, todo: { ...todo } });
    const closeEditor = () => setEditor(null);
    const saveEditor = async (patch) => {
      await window.TodosStore.update(editor.todo.id, patch);
      await window.TodosStore.reload();
      closeEditor();
    };
    const deleteEditor = () => {
      window.TodosStore.remove(editor.todo.id);
      closeEditor();
    };

    const selectStyle = {
      height: 34,
      padding: '0 10px',
      background: pal.card,
      color: pal.text,
      border: `1px solid ${pal.border}`,
      borderRadius: 7,
      fontSize: 12.5,
      fontFamily: 'inherit',
      outline: 'none',
      minWidth: 0,
    };

    return (
      <div style={{
        flex: 1,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: pal.text, letterSpacing: -0.3 }}>
              Completed tasks
            </div>
            <div style={{ fontSize: 12.5, color: pal.textSoft, marginTop: 2 }}>
              {counts.total} total · {counts.last7} this week · {counts.last30} last 30 days
            </div>
          </div>
          <window.Link to="/board" style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: 34,
            padding: '0 12px',
            background: 'transparent',
            color: pal.textSoft,
            border: `1px solid ${pal.border}`,
            borderRadius: 7,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            textDecoration: 'none',
          }}>
            ← Back to board
          </window.Link>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.7fr .9fr 1fr 1fr auto',
          gap: 8,
          alignItems: 'center',
          background: pal.card,
          border: `1px solid ${pal.border}`,
          borderRadius: 10,
          padding: 10,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 34,
            padding: '0 10px',
            background: pal.cardAlt,
            border: `1px solid ${pal.border}`,
            borderRadius: 7,
          }}>
            <Icon name="search" size={14} color={pal.textFaint} />
            <input
              value={filters.q}
              onChange={(e) => setFilter('q', e.target.value)}
              placeholder="Search title, notes, link, category"
              style={{
                flex: 1,
                minWidth: 0,
                background: 'transparent',
                border: 'none',
                color: pal.text,
                outline: 'none',
                fontSize: 12.5,
                fontFamily: 'inherit',
              }}
            />
          </div>
          <select style={selectStyle} value={filters.owner} onChange={(e) => setFilter('owner', e.target.value)}>
            <option value="all">All owners</option>
            <option value="unassigned">Unassigned</option>
            {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select style={selectStyle} value={filters.label} onChange={(e) => setFilter('label', e.target.value)}>
            <option value="all">All categories</option>
            {window.RCIS_DATA.LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select style={selectStyle} value={filters.range} onChange={(e) => setFilter('range', e.target.value)}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <button onClick={clearFilters} style={{
            height: 34,
            padding: '0 11px',
            background: 'transparent',
            color: pal.textSoft,
            border: `1px solid ${pal.border}`,
            borderRadius: 7,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}>Reset</button>
        </div>

        <div style={{
          background: pal.card,
          border: `1px solid ${pal.border}`,
          borderRadius: 10,
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 120px 110px 130px',
            gap: 12,
            padding: '9px 14px',
            borderBottom: `1px solid ${pal.borderSoft}`,
            background: pal.cardAlt,
            fontSize: 10.5,
            color: pal.textFaint,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}>
            <span>Task</span>
            <span>Category</span>
            <span>Owner</span>
            <span>Completed</span>
          </div>
          {filtered.length === 0 ? (
            <div style={{
              padding: 28,
              textAlign: 'center',
              color: pal.textFaint,
              fontSize: 13,
            }}>
              No completed tasks match these filters.
            </div>
          ) : (
            filtered.map((t, i) => (
              <button
                key={t.id}
                onClick={() => openEdit(t)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 110px 130px',
                  gap: 12,
                  padding: '10px 14px',
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: i < filtered.length - 1 ? `1px solid ${pal.borderSoft}` : 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  alignItems: 'center',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    color: pal.text,
                    fontSize: 12.8,
                    fontWeight: 600,
                    lineHeight: 1.3,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>{t.title || '(untitled)'}</div>
                  {t.linkedTo && (
                    <div style={{
                      marginTop: 3,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      maxWidth: '100%',
                      padding: '1px 6px',
                      background: pal.chipBg,
                      borderRadius: 4,
                      color: pal.textSoft,
                      fontSize: 10.5,
                    }}>
                      <window.LinkTypeBadge type={t.linkedTo.type} pal={pal} />
                      <span style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>{t.linkedTo.name}</span>
                    </div>
                  )}
                </div>
                <span style={{
                  justifySelf: 'start',
                  fontSize: 10.5,
                  color: pal.textSoft,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: pal.chipBg,
                }}>{t.label}</span>
                <span style={{ display: 'flex' }}>
                  {t.owners.length === 0 ? (
                    <span style={{ fontSize: 10.5, color: pal.textFaint, fontStyle: 'italic' }}>—</span>
                  ) : (
                    t.owners.map((id, idx) => (
                      <span key={id} style={{ marginLeft: idx === 0 ? 0 : -5 }}>
                        <OwnerAvatar id={id} size={20} ring={pal.card} />
                      </span>
                    ))
                  )}
                </span>
                <span style={{
                  fontSize: 12,
                  color: pal.textSoft,
                  fontVariantNumeric: 'tabular-nums',
                }}>{formatCompleted(t.completedAt || t.updatedAt)}</span>
              </button>
            ))
          )}
        </div>

        {editor && (
          <window.TodoEditor
            todo={editor.todo}
            pal={pal}
            isNew={false}
            onSave={saveEditor}
            onDelete={deleteEditor}
            onClose={closeEditor}
          />
        )}
      </div>
    );
  }

  function formatCompleted(timestamp) {
    if (!timestamp) return '—';
    const d = new Date(timestamp);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dDay = new Date(d); dDay.setHours(0, 0, 0, 0);
    const diff = Math.round((today - dDay) / (24 * 60 * 60 * 1000));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff}d ago`;
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: sameYear ? undefined : 'numeric',
    });
  }

  window.CompletedPage = CompletedPage;
})();
