// Calm Ops — minimal, Notion/Linear-leaning. Brand teal as quiet accent,
// coral reserved for warnings. Lots of negative space.
//
// Chrome (palette + top bar + sidebar) lives in shell-calm.jsx so other
// pages share it. This file owns the dashboard widgets + main layout.

(function () {
  const { teamMember, SpecChip, StatusPill, OwnerAvatar, PrioDot, CapacityBar, WeekGrid, MiniSpark, Icon } = window;



  // ─── Stat tile ────────────────────────────────────────────────────────────
  function StatTile({ pal, label, value, delta, deltaSub, trend, deltaTone }) {
    const deltaColor = deltaTone === 'pos' ? '#3E8A57' : deltaTone === 'neg' ? pal.warn : pal.textFaint;
    const sparkColor = deltaTone === 'neg' ? pal.warn : deltaTone === 'pos' ? pal.accent : pal.textFaint;
    return (
      <div style={{
        flex: 1, padding: '12px 14px',
        background: pal.card,
        border: `1px solid ${pal.border}`,
        borderRadius: 10,
        display: 'flex', flexDirection: 'column', gap: 6,
        minWidth: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.9,
            color: pal.textFaint, textTransform: 'uppercase',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{label}</div>
          {trend && <MiniSpark values={trend} color={sparkColor} w={56} h={18} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{
            fontSize: 26, fontWeight: 600, color: pal.text, letterSpacing: -0.6,
            fontVariantNumeric: 'tabular-nums', lineHeight: 1,
          }}>{value}</div>
          {delta && (
            <span style={{
              fontSize: 11.5, fontWeight: 700, color: deltaColor,
              fontVariantNumeric: 'tabular-nums', fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
            }}>{delta}</span>
          )}
        </div>
        {deltaSub && (
          <div style={{ fontSize: 10.5, color: pal.textFaint, fontWeight: 500 }}>{deltaSub}</div>
        )}
      </div>
    );
  }

  // ─── Card shell ───────────────────────────────────────────────────────────
  function Card({ pal, title, count, action, children, style }) {
    return (
      <div style={{
        background: pal.card,
        border: `1px solid ${pal.border}`,
        borderRadius: 10,
        padding: 16,
        display: 'flex', flexDirection: 'column', gap: 12,
        overflow: 'hidden',
        ...style,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: pal.text, letterSpacing: -0.1 }}>{title}</h3>
          {count != null && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: pal.textSoft,
              background: pal.chipBg, padding: '1px 7px', borderRadius: 10,
              fontVariantNumeric: 'tabular-nums',
            }}>{count}</span>
          )}
          {action && (
            <span style={{ marginLeft: 'auto', fontSize: 12, color: pal.textSoft, cursor: 'pointer' }}>{action}</span>
          )}
        </div>
        {children}
      </div>
    );
  }

  // ─── Coverage gaps ────────────────────────────────────────────────────────
  function CoverageGaps({ pal }) {
    const allGaps = window.useCoverageGaps ? window.useCoverageGaps() : [];
    const openGaps = React.useMemo(
      () => allGaps.filter((g) => g.status === 'open'),
      [allGaps],
    );
    const rows = openGaps.slice(0, 6);
    const [editor, setEditor] = React.useState(null);

    const openNew = () => {
      setEditor({ isNew: true, gap: {} });
    };
    const openEdit = (g) => setEditor({ isNew: false, gap: { ...g } });
    const closeEditor = () => setEditor(null);
    const saveEditor = async (patch) => {
      if (editor.isNew) {
        const { id, ...rest } = patch;
        await window.GapsStore.add(rest);
      } else {
        await window.GapsStore.update(editor.gap.id, patch);
      }
      closeEditor();
    };
    const deleteEditor = async () => {
      await window.GapsStore.remove(editor.gap.id);
      closeEditor();
    };

    return (
      <>
        <Card pal={pal} title="Coverage gaps" count={openGaps.length}
              action={(
                <button onClick={openNew} style={{
                  background: 'transparent', border: 'none',
                  color: pal.accent, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>+ Log gap</button>
              )}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {rows.length === 0 && (
              <div style={{ padding: '14px 4px', fontSize: 12, color: pal.textFaint }}>
                No open coverage gaps logged.
              </div>
            )}
            {rows.map((g, i) => {
              const displayName = g.scope === 'district'
                ? `${g.districtName} (district-wide)`
                : (g.schoolName || g.districtName);
              const posted = relPosted(g.postedAt);
              return (
                <button key={g.id} onClick={() => openEdit(g)} style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto auto auto',
                  gap: 12, alignItems: 'center',
                  padding: '8px 4px',
                  borderBottom: i < rows.length - 1 ? `1px solid ${pal.borderSoft}` : 'none',
                  fontSize: 12.5,
                  background: 'transparent', border: 'none', width: '100%',
                  textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  <PrioDot prio={g.priority} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: pal.text, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
                    <div style={{ color: pal.textFaint, fontSize: 11, marginTop: 1 }}>{g.districtName} · {g.state}</div>
                  </div>
                  <SpecChip code={g.spec} />
                  <div style={{ color: pal.textSoft, fontSize: 12, fontVariantNumeric: 'tabular-nums', width: 56, textAlign: 'right' }}>{g.hours}h/wk</div>
                  <div style={{ color: pal.textFaint, fontSize: 11, width: 36, textAlign: 'right' }}>{posted}</div>
                </button>
              );
            })}
          </div>
        </Card>
        {editor && (
          <window.GapEditor
            gap={editor.gap}
            pal={pal}
            isNew={editor.isNew}
            onSave={saveEditor}
            onDelete={deleteEditor}
            onClose={closeEditor}
          />
        )}
      </>
    );
  }

  function relPosted(ms) {
    if (!ms) return '';
    const days = Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
    if (days < 1) return 'today';
    return days + 'd';
  }

  // ─── Capacity now ─────────────────────────────────────────────────────────
  function CapacityNow({ pal }) {
    const list = window.RCIS_DATA.CONTRACTORS
      .filter(c => c.status === 'avail' || c.status === 'partial')
      .slice(0, 6);
    return (
      <Card pal={pal} title="Has capacity now" count={list.length} action="Filter →">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map((c, i) => {
            const free = c.cap - c.assigned;
            return (
              <div key={c.id} style={{
                display: 'grid', gridTemplateColumns: '28px 1fr 90px 64px',
                gap: 10, alignItems: 'center',
                paddingBottom: i < list.length - 1 ? 8 : 0,
                borderBottom: i < list.length - 1 ? `1px solid ${pal.borderSoft}` : 'none',
              }}>
                <span style={{
                  width: 28, height: 28, borderRadius: 14,
                  background: window.specColor(c.spec) + '22',
                  color: window.specColor(c.spec),
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                }}>{c.name.split(' ').map(p => p[0]).join('')}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: pal.text, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: pal.textFaint, display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                    <SpecChip code={c.spec} />
                    <span>{c.states.join(', ')}</span>
                  </div>
                </div>
                <div>
                  <CapacityBar assigned={c.assigned} cap={c.cap} track={pal.chipBg} fill={pal.accent} />
                  <div style={{ fontSize: 10, color: pal.textFaint, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{c.assigned}/{c.cap}h</div>
                </div>
                <div style={{ fontSize: 12, color: pal.accent, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>+{free}h free</div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  // ─── Kanban ───────────────────────────────────────────────────────────────
  // Connected to TodosStore — drag between columns, click to edit, + to add.
  function Kanban({ pal }) {
    const TodoEditor = window.TodoEditor;
    const todos = window.useTodos();
    const team = window.useTeam ? window.useTeam() : window.RCIS_DATA.TEAM;
    const [editor, setEditor] = React.useState(null); // { todo, isNew } | null
    const [dragId, setDragId] = React.useState(null);
    const [dragOver, setDragOver] = React.useState(null);

    const cols = [
      { key: 'todo',      title: 'To Do',           tint: pal.textFaint, accent: pal.textFaint },
      { key: 'doing',     title: 'Doing',           tint: pal.accent,    accent: pal.accent },
      { key: 'attention', title: 'Needs attention', tint: '#C98A2C',     accent: '#C98A2C' },
      { key: 'done',      title: 'Done',            tint: '#3E8A57',     accent: '#3E8A57' },
    ];

    const RECENT_DONE_DAYS = 5;
    const byColumn = React.useMemo(() => {
      const out = { todo: [], doing: [], attention: [], done: [] };
      for (const t of todos) if (out[t.column]) out[t.column].push(t);
      for (const k of Object.keys(out)) out[k].sort((a, b) => b.updatedAt - a.updatedAt);
      return out;
    }, [todos]);
    const doneTotal = byColumn.done.length;
    const doneVisible = React.useMemo(() => {
      const cutoff = Date.now() - RECENT_DONE_DAYS * 24 * 60 * 60 * 1000;
      return byColumn.done.filter((t) => (t.completedAt || t.updatedAt || 0) >= cutoff);
    }, [byColumn.done]);

    const openNew = (column) => {
      const current = window.TeamStore && window.TeamStore.current();
      setEditor({
        todo: {
          id: null, title: '', column: column || 'todo',
          owners: current ? [current.id] : [], label: 'Ops', priority: 'medium',
          due: null, linkedTo: null,
        },
        isNew: true,
      });
    };
    const openEdit = (t) => setEditor({ todo: { ...t }, isNew: false });
    const closeEditor = () => setEditor(null);
    const saveEditor = (patch) => {
      if (editor.isNew) {
        const { id, ...rest } = patch;
        window.TodosStore.add(rest);
      } else {
        window.TodosStore.update(editor.todo.id, patch);
      }
      closeEditor();
    };
    const deleteEditor = () => {
      window.TodosStore.remove(editor.todo.id);
      closeEditor();
    };

    const onCardDragStart = (e, id) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
      setDragId(id);
    };
    const onCardDragEnd = () => { setDragId(null); setDragOver(null); };
    const onColDragOver = (e, col) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragOver !== col) setDragOver(col);
    };
    const onColDrop = (e, col) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain') || dragId;
      if (id) window.TodosStore.move(id, col);
      setDragId(null); setDragOver(null);
    };

    return (
      <>
        <div style={{
          background: pal.card, border: `1px solid ${pal.border}`, borderRadius: 10, padding: 16,
          display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, overflow: 'hidden',
          width: '100%', flex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: pal.text }}>Task board</h3>
            <span style={{ fontSize: 11, color: pal.textFaint }}>· {todos.length} cards · {todos.filter(t => t.column !== 'done').length} open</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {team.map(t => {
                  const count = todos.filter(x => x.owners.includes(t.id) && x.column !== 'done').length;
                  return (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 8px 2px 4px',
                      borderRadius: 999, background: pal.chipBg, fontSize: 11, color: pal.textSoft }}>
                      <OwnerAvatar id={t.id} size={16} />
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{count}</span>
                    </div>
                  );
                })}
              </div>
              <button onClick={() => openNew('todo')} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px',
                background: pal.accent, color: '#fff',
                border: 'none', borderRadius: 6,
                fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <Icon name="plus" size={12} stroke={2.4} /> New task
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, minHeight: 0 }}>
            {cols.map(col => {
              const items = col.key === 'done' ? doneVisible : byColumn[col.key];
              const hiddenDone = col.key === 'done' ? Math.max(0, doneTotal - items.length) : 0;
              const isOver = dragOver === col.key;
              return (
                <div key={col.key}
                  onDragOver={(e) => onColDragOver(e, col.key)}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => onColDrop(e, col.key)}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 8,
                    padding: 10, borderRadius: 8,
                    background: isOver ? pal.accentSoft : pal.cardAlt,
                    border: `1.5px ${isOver ? 'dashed' : 'solid'} ${isOver ? pal.accent : pal.borderSoft}`,
                    minHeight: 220,
                    transition: 'background .12s, border-color .12s',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 4, background: col.tint }} />
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
                      textTransform: 'uppercase', color: pal.textSoft }}>{col.title}</span>
                    <span style={{ fontSize: 11, color: pal.textFaint, fontVariantNumeric: 'tabular-nums', marginLeft: 'auto' }}>{col.key === 'done' ? doneTotal : items.length}</span>
                    <button onClick={() => openNew(col.key)} title="Add to this column"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 18, height: 18, padding: 0,
                        background: 'transparent', color: pal.textFaint,
                        border: `1px solid ${pal.border}`, borderRadius: 4,
                        cursor: 'pointer',
                      }}>
                      <Icon name="plus" size={10} stroke={2.4} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {items.map(t => (
                      <TodoCard key={t.id} todo={t} pal={pal}
                        onClick={() => openEdit(t)}
                        onDragStart={(e) => onCardDragStart(e, t.id)}
                        onDragEnd={onCardDragEnd}
                        isDragging={dragId === t.id} />
                    ))}
                    {items.length === 0 && (
                      <div style={{
                        padding: '14px 10px', textAlign: 'center',
                        fontSize: 11, color: pal.textFaint,
                        border: `1px dashed ${pal.border}`, borderRadius: 6,
                      }}>Drop here or + add</div>
                    )}
                    {col.key === 'done' && hiddenDone > 0 && (
                      <window.Link to="/board" style={{
                        display: 'block', padding: '6px 8px',
                        textAlign: 'center', fontSize: 11, fontWeight: 600,
                        color: pal.textSoft, textDecoration: 'none',
                        border: `1px dashed ${pal.border}`, borderRadius: 6,
                      }}>View {hiddenDone} more in Tasks →</window.Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {editor && (
          <TodoEditor
            todo={editor.todo}
            pal={pal}
            isNew={editor.isNew}
            onSave={saveEditor}
            onDelete={deleteEditor}
            onClose={closeEditor}
          />
        )}
      </>
    );
  }

  // Single card. Draggable, clickable, shows multi-owner stack + linked-to chip.
  function TodoCard({ todo, pal, onClick, onDragStart, onDragEnd, isDragging }) {
    const LinkTypeBadge = window.LinkTypeBadge;
    const PRIO = { high: '#D97757', medium: '#C98A2C', low: '#7A8290' };
    const dueLabel = formatDue(todo.due);
    const overdue = isDueOverdue(todo.due, todo.column);
    const commentCount = window.useTaskCommentCount ? window.useTaskCommentCount(todo.id) : 0;

    return (
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onClick}
        style={{
          padding: '8px 10px',
          background: pal.card,
          border: `1px solid ${pal.border}`,
          borderLeft: `3px solid ${PRIO[todo.priority]}`,
          borderRadius: 7,
          display: 'flex', flexDirection: 'column', gap: 6,
          cursor: 'grab',
          opacity: isDragging ? 0.4 : 1,
          transition: 'opacity .15s, box-shadow .15s, transform .12s',
          boxShadow: isDragging ? 'none' : '0 1px 2px rgba(0,0,0,.04)',
        }}
        onMouseEnter={(e) => { if (!isDragging) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.08)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = isDragging ? 'none' : '0 1px 2px rgba(0,0,0,.04)'; }}
      >
        <div style={{ fontSize: 12.5, color: pal.text, fontWeight: 500, lineHeight: 1.35, textDecoration: todo.column === 'done' ? 'line-through' : 'none', opacity: todo.column === 'done' ? 0.65 : 1 }}>
          {todo.title}
        </div>

        {todo.linkedTo && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 10.5, color: pal.textSoft,
            padding: '2px 6px',
            background: pal.chipBg,
            borderRadius: 4,
            alignSelf: 'flex-start',
            maxWidth: '100%',
          }}>
            <LinkTypeBadge type={todo.linkedTo.type} pal={pal} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{todo.linkedTo.name}</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: pal.textSoft,
            padding: '1px 6px', borderRadius: 4, background: pal.chipBg }}>{todo.label}</span>
          {dueLabel && (
            <span style={{
              fontSize: 10.5, fontWeight: 600,
              color: overdue ? pal.warn : pal.textFaint,
              fontVariantNumeric: 'tabular-nums',
            }}>{overdue ? '⚠ ' : ''}{dueLabel}</span>
          )}
          {(todo.notes && todo.notes.trim()) || (todo.attachments && todo.attachments.length > 0) || commentCount > 0 ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: pal.textFaint }}>
              {todo.notes && todo.notes.trim() && (
                <span title="Has notes" style={{ display: 'inline-flex' }}>
                  <Icon name="list" size={11} stroke={2} />
                </span>
              )}
              {todo.attachments && todo.attachments.length > 0 && (
                <span title={`${todo.attachments.length} attachment${todo.attachments.length === 1 ? '' : 's'}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10.5, fontWeight: 600 }}>
                  <Icon name="file" size={11} stroke={2} />
                  {todo.attachments.length > 1 && (
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{todo.attachments.length}</span>
                  )}
                </span>
              )}
              {commentCount > 0 && (
                <span title={`${commentCount} comment${commentCount === 1 ? '' : 's'}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10.5, fontWeight: 600 }}>
                  <Icon name="msg" size={11} stroke={2} />{commentCount}
                </span>
              )}
            </span>
          ) : null}
          <span style={{ marginLeft: 'auto', display: 'flex' }}>
            {todo.owners.length === 0 ? (
              <span style={{ fontSize: 10, color: pal.textFaint, fontStyle: 'italic' }}>unassigned</span>
            ) : (
              todo.owners.map((id, i) => (
                <span key={id} style={{ marginLeft: i === 0 ? 0 : -5 }}>
                  <OwnerAvatar id={id} size={18} ring={pal.card} />
                </span>
              ))
            )}
          </span>
        </div>
      </div>
    );
  }

  function formatDue(iso) {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    if (!y) return null;
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function isDueOverdue(iso, column) {
    if (!iso || column === 'done') return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).getTime() < today.getTime();
  }

  // ─── Renewals ─────────────────────────────────────────────────────────────
  function Renewals({ pal }) {
    const all = window.useRenewals ? window.useRenewals() : [];
    // Only show what's actually urgent — anything past 60 days out is noise
    // on the home dashboard. Use the renewals page for the full list.
    const open = React.useMemo(
      () => all
        .filter((r) => r.status !== 'lapsed')
        .filter((r) => {
          const u = window.renewalUrgency && window.renewalUrgency(r.expiresOn);
          return u === 'overdue' || u === 'soon' || u === 'upcoming';
        })
        .sort((a, b) => {
          const ax = a.expiresOn || '9999-12-31';
          const bx = b.expiresOn || '9999-12-31';
          return ax.localeCompare(bx);
        }),
      [all],
    );
    const rows = open.slice(0, 5);
    const [editor, setEditor] = React.useState(null);

    const openNew  = () => setEditor({ isNew: true,  renewal: {} });
    const openEdit = (r) => setEditor({ isNew: false, renewal: { ...r } });
    const close    = () => setEditor(null);
    const save = async (patch) => {
      if (editor.isNew) {
        const { id, ...rest } = patch;
        await window.RenewalsStore.add(rest);
      } else {
        await window.RenewalsStore.update(editor.renewal.id, patch);
      }
      close();
    };
    const del = async () => {
      await window.RenewalsStore.remove(editor.renewal.id);
      close();
    };

    return (
      <>
        <Card pal={pal} title="Upcoming renewals" count={open.length}
              action={(
                <button onClick={openNew} style={{
                  background: 'transparent', border: 'none',
                  color: pal.accent, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>+ Log renewal</button>
              )}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {rows.length === 0 && (
              <div style={{ padding: '14px 4px', fontSize: 12, color: pal.textFaint }}>
                {all.length === 0
                  ? 'Nothing tracked yet. Log a license, policy, or contract to get started.'
                  : 'Nothing due in the next 60 days — quiet stretch.'}
              </div>
            )}
            {rows.map((r, i) => {
              const kindMeta = window.renewalKindMeta ? window.renewalKindMeta(r.kind) : { color: pal.textSoft };
              const days = window.daysUntilRenewal(r.expiresOn);
              const urgency = window.renewalUrgency(r.expiresOn);
              const urgentColor = urgency === 'overdue' ? '#E76B5D'
                                : urgency === 'soon'    ? '#C98A2C'
                                : pal.textSoft;
              const owner = r.contractorName || r.schoolName || r.districtName || '—';
              const label = r.label
                ? `${owner} · ${r.label}${r.state ? ` (${r.state})` : ''}`
                : owner;
              const daysLabel = days == null ? '—'
                              : days < 0    ? `${Math.abs(days)}d over`
                              : days === 0  ? 'today'
                              : `${days}d`;
              return (
                <button key={r.id} onClick={() => openEdit(r)} style={{
                  display: 'grid',
                  gridTemplateColumns: '70px 1fr auto',
                  gap: 10, alignItems: 'center',
                  padding: '8px 4px',
                  borderBottom: i < rows.length - 1 ? `1px solid ${pal.borderSoft}` : 'none',
                  background: 'transparent', border: 'none', width: '100%',
                  textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    color: kindMeta.color,
                    background: kindMeta.color + '18',
                    padding: '3px 6px', borderRadius: 4, textAlign: 'center',
                  }}>{shortRenewalKind(r.kind)}</span>
                  <div style={{ fontSize: 12.5, color: pal.text, fontWeight: 500,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: urgentColor,
                    fontVariantNumeric: 'tabular-nums',
                    width: 60, textAlign: 'right',
                  }}>{daysLabel}</span>
                </button>
              );
            })}
          </div>
        </Card>
        {editor && (
          <window.RenewalEditor
            renewal={editor.renewal}
            pal={pal}
            isNew={editor.isNew}
            onSave={save}
            onDelete={del}
            onClose={close}
          />
        )}
      </>
    );
  }
  function shortRenewalKind(k) {
    if (k === 'contractor_license')    return 'License';
    if (k === 'contractor_insurance')  return 'Insurance';
    if (k === 'contractor_background') return 'Background';
    if (k === 'client_contract')       return 'Contract';
    return k;
  }

  // ─── Pinned notes ─────────────────────────────────────────────────────────
  function PinnedNotes({ pal }) {
    const notes = window.RCIS_DATA.NOTES;
    return (
      <Card pal={pal} title="Pinned notes" action="+ Add note">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notes.map((n, i) => {
            const author = teamMember(n.author);
            return (
              <div key={n.id} style={{ display: 'flex', gap: 10 }}>
                <OwnerAvatar id={n.author} size={24} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: pal.text }}>{author.name.split(' ')[0]}</span>
                    <span style={{ fontSize: 10.5, color: pal.textFaint }}>{n.time}</span>
                  </div>
                  <div style={{ fontSize: 12, color: pal.textSoft, lineHeight: 1.45 }}>{n.text}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  // ─── Main ─────────────────────────────────────────────────────────────────
  function DashboardCalm({ dark = false, widgets = {} }) {
    if (window.useTeam) window.useTeam();
    const current = window.TeamStore && window.TeamStore.current();
    const firstName = current && current.name ? current.name.split(' ')[0] : 'there';
    const show = (k) => widgets[k] !== false;
    return (
      <window.PageShell dark={dark} activePage="home">
        {(pal) => (
          <div style={{
            flex: 1, padding: '20px 24px',
            display: 'flex', flexDirection: 'column', gap: 14,
            overflowY: 'auto',
          }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600, color: pal.text, letterSpacing: -0.3 }}>
                Good morning, {firstName}
              </div>
              <div style={{ fontSize: 12.5, color: pal.textSoft, marginTop: 2 }}>
                {window.RCIS_TODAY} · <span style={{ color: pal.warn, fontWeight: 600 }}>3 urgent gaps</span> · 5 renewals due in 30 days
              </div>
            </div>

            {show('stats') && (
              <div style={{ display: 'flex', gap: 10 }}>
                <StatTile pal={pal} label="Hours last week"    value="1,284" delta="+38"  deltaSub="vs prior week" trend={[1180,1200,1220,1240,1260,1270,1278,1280,1282,1285,1284,1284]} deltaTone="pos" />
                <StatTile pal={pal} label="Active contractors" value="48"  delta="+2"   deltaSub="net hires"     trend={[43,44,44,45,46,46,47,47,47,48,48,48]}             deltaTone="pos" />
                <StatTile pal={pal} label="Open coverage"     value="7"   delta="+1"   deltaSub="3 urgent"      trend={[5,5,6,6,6,7,7,7,8,7,7,7]}                          deltaTone="neg" />
                <StatTile pal={pal} label="Renewals < 30d"    value="5"   delta="—"    deltaSub="1 this week"   trend={[3,3,4,4,4,4,5,5,5,5,5,5]}                          deltaTone="neutral" />
                <StatTile pal={pal} label="Hours filled"      value="92%" delta="+0.4" deltaSub="vs last week"  trend={[88,89,90,90,91,92,92,93,92,93,92,93]}              deltaTone="pos" />
              </div>
            )}

            {show('kanban') && (
              <div style={{ display: 'flex' }}>
                <Kanban pal={pal} />
              </div>
            )}

            {(show('gaps') || show('capacity')) && (
              <div style={{ display: 'grid', gridTemplateColumns: show('gaps') && show('capacity') ? '1fr 1fr' : '1fr', gap: 12 }}>
                {show('gaps') && <CoverageGaps pal={pal} />}
                {show('capacity') && <CapacityNow pal={pal} />}
              </div>
            )}

            {(show('renewals') || show('notes')) && (
              <div style={{ display: 'grid', gridTemplateColumns: show('renewals') && show('notes') ? '1fr 1fr' : '1fr', gap: 12 }}>
                {show('renewals') && <Renewals pal={pal} />}
                {show('notes') && <PinnedNotes pal={pal} />}
              </div>
            )}
          </div>
        )}
      </window.PageShell>
    );
  }

  window.DashboardCalm = DashboardCalm;
})();
