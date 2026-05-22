// TasksPage - focused workspace for team tasks and follow-ups.
// Uses the existing Supabase-backed TodosStore and TodoEditor modal.

(function () {
  const { OwnerAvatar, Icon, teamMember } = window;

  const PRIO = { high: '#D97757', medium: '#C98A2C', low: '#7A8290' };
  const STATUS = {
    todo: { label: 'To Do', color: '#7A8290' },
    doing: { label: 'Doing', color: '#2BBFB5' },
    attention: { label: 'Needs attention', color: '#C98A2C' },
    done: { label: 'Done', color: '#3E8A57' },
  };
  const DEFAULT_FILTERS = {
    q: '',
    owner: 'all',
    status: 'open',
    priority: 'all',
    label: 'all',
    due: 'all',
  };
  // Done tasks completed within this many days stay visible under the default
  // "Open" filter so the team can see recent wins at a glance. Older ones
  // archive and only surface when status is set to Done or All.
  const RECENT_DONE_DAYS = 5;

  function TasksPage({ dark = false }) {
    return (
      <window.PageShell dark={dark} activePage="board" searchPlaceholder="Search tasks and follow-ups">
        {(pal) => <TasksWorkspace pal={pal} />}
      </window.PageShell>
    );
  }

  function TasksWorkspace({ pal }) {
    const todos = window.useTodos();
    const team = window.useTeam();
    // Re-render when contractor / contact / school / district names change so
    // linked-task chips + filters stay fresh.
    if (window.useContractorOverrides) window.useContractorOverrides();
    if (window.useContacts) window.useContacts();
    if (window.useSchoolOverrides)   window.useSchoolOverrides();
    if (window.useDistrictOverrides) window.useDistrictOverrides();
    const [editor, setEditor] = React.useState(null);
    const [dragId, setDragId] = React.useState(null);
    const [dragOver, setDragOver] = React.useState(null);
    const [filters, setFilters] = React.useState(DEFAULT_FILTERS);

    const filtered = React.useMemo(() => {
      return todos.filter((t) => matchesFilters(t, filters));
    }, [todos, filters]);

    const counts = React.useMemo(() => summarize(todos), [todos]);
    const byColumn = React.useMemo(() => {
      const out = { todo: [], doing: [], attention: [], done: [] };
      for (const t of filtered) {
        if (out[t.column]) out[t.column].push(t);
      }
      for (const key of Object.keys(out)) {
        out[key].sort(sortTasks);
      }
      return out;
    }, [filtered]);

    const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
    const clearFilters = () => setFilters(DEFAULT_FILTERS);

    const openNew = (column = 'todo') => {
      const current = window.TeamStore && window.TeamStore.current();
      setEditor({
        isNew: true,
        todo: {
          id: null,
          title: '',
          column,
          owners: current ? [current.id] : [],
          label: 'Ops',
          priority: 'medium',
          due: null,
          linkedTo: null,
          notes: '',
          attachments: [],
        },
      });
    };
    const openEdit = (todo) => setEditor({ isNew: false, todo: { ...todo } });
    const closeEditor = () => setEditor(null);
    const saveEditor = async (patch) => {
      if (editor.isNew) {
        const { id, ...rest } = patch;
        setFilters(DEFAULT_FILTERS);
        await window.TodosStore.add(rest);
      } else {
        await window.TodosStore.update(editor.todo.id, patch);
      }
      await window.TodosStore.reload();
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
    const onColumnDragOver = (e, column) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragOver !== column) setDragOver(column);
    };
    const onColumnDrop = (e, column) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain') || dragId;
      if (id) window.TodosStore.move(id, column);
      setDragId(null);
      setDragOver(null);
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
              Tasks & follow-ups
            </div>
            <div style={{ fontSize: 12.5, color: pal.textSoft, marginTop: 2 }}>
              {counts.open} open · {counts.overdue} overdue · {counts.dueSoon} due this week · {counts.unassigned} unassigned
            </div>
          </div>
          <button onClick={() => openNew('todo')} style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            height: 34,
            padding: '0 13px',
            background: pal.accent,
            color: '#fff',
            border: 'none',
            borderRadius: 7,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}>
            <Icon name="plus" size={14} stroke={2.3} /> New task
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          <MetricCard pal={pal} label="Open" value={counts.open} tone={pal.accent} />
          <MetricCard pal={pal} label="Overdue" value={counts.overdue} tone={pal.warn} />
          <MetricCard pal={pal} label="Due this week" value={counts.dueSoon} tone="#C98A2C" />
          <MetricCard pal={pal} label="Unassigned" value={counts.unassigned} tone="#7A8290" />
          <MetricCard pal={pal} label="Done this week" value={counts.doneThisWeek} tone="#3E8A57" />
        </div>

        <Filters pal={pal} team={team} filters={filters} setFilter={setFilter} clearFilters={clearFilters} todos={todos} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12, minHeight: 0 }}>
          <div style={{
            background: pal.card,
            border: `1px solid ${pal.border}`,
            borderRadius: 10,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            minHeight: 560,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, minHeight: 0 }}>
              {['todo', 'doing', 'attention', 'done'].map((column) => (
                <TaskColumn
                  key={column}
                  column={column}
                  items={byColumn[column]}
                  pal={pal}
                  isOver={dragOver === column}
                  onAdd={() => openNew(column)}
                  onOpen={openEdit}
                  onDragStart={onCardDragStart}
                  onDragEnd={onCardDragEnd}
                  onDragOver={(e) => onColumnDragOver(e, column)}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => onColumnDrop(e, column)}
                  dragId={dragId}
                />
              ))}
            </div>
          </div>

          <FocusPanel pal={pal} team={team} todos={todos} onOpen={openEdit} />
        </div>

        {editor && (
          <window.TodoEditor
            todo={editor.todo}
            pal={pal}
            isNew={editor.isNew}
            onSave={saveEditor}
            onDelete={deleteEditor}
            onClose={closeEditor}
          />
        )}
      </div>
    );
  }

  function MetricCard({ pal, label, value, tone }) {
    return (
      <div style={{
        background: pal.card,
        border: `1px solid ${pal.border}`,
        borderRadius: 8,
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minHeight: 58,
      }}>
        <span style={{ width: 8, height: 34, borderRadius: 4, background: tone, opacity: 0.9 }} />
        <div>
          <div style={{ fontSize: 11, color: pal.textFaint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
          <div style={{ fontSize: 22, color: pal.text, fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
        </div>
      </div>
    );
  }

  function Filters({ pal, team, filters, setFilter, clearFilters, todos }) {
    const currentUser = window.TeamStore && window.TeamStore.current && window.TeamStore.current();
    const myActive = !!(currentUser && filters.owner === currentUser.id);

    // Live counts for each quick-filter chip — computed against the full
    // todos list, independent of other filters. Always counts "open"
    // (anything not Done) so chips reflect what's still actionable.
    const isOpen = (t) => t.column !== 'done';
    const chipCounts = React.useMemo(() => ({
      mine:      currentUser ? todos.filter((t) => isOpen(t) && (t.owners || []).includes(currentUser.id)).length : 0,
      overdue:   todos.filter((t) => isOpen(t) && isOverdue(t.due)).length,
      today:     todos.filter((t) => isOpen(t) && isToday(t.due)).length,
      week:      todos.filter((t) => isOpen(t) && isDueThisWeek(t.due)).length,
      attention: todos.filter((t) => t.column === 'attention').length,
    }), [todos, currentUser && currentUser.id]);

    // "All" is active when no chip-controlled dimension is set.
    const dueActive       = filters.due === 'overdue' || filters.due === 'today' || filters.due === 'week';
    const attentionActive = filters.status === 'attention';
    const allActive       = !dueActive && !attentionActive;
    const setQuickDue = (key) => {
      // Toggling the same chip clears it back to "All".
      const next = filters.due === key ? 'all' : key;
      setFilter('due', next);
      // Quick chips imply open scope; nudge status back to 'open' if it
      // had drifted to 'attention'.
      if (next !== 'all' && filters.status === 'attention') setFilter('status', 'open');
    };
    const setAttention = () => {
      const next = filters.status === 'attention' ? 'open' : 'attention';
      setFilter('status', next);
      if (next === 'attention' && filters.due !== 'all') setFilter('due', 'all');
    };
    const setAll = () => {
      if (filters.due !== 'all')         setFilter('due', 'all');
      if (filters.status === 'attention') setFilter('status', 'open');
    };

    const chipStyle = (active, tone) => ({
      display: 'inline-flex', alignItems: 'center', gap: 5,
      height: 26, padding: '0 10px',
      background: active ? (tone || pal.accent) : 'transparent',
      color: active ? '#fff' : pal.textSoft,
      border: `1px solid ${active ? (tone || pal.accent) : pal.border}`,
      borderRadius: 14,
      fontSize: 12, fontWeight: 600,
      cursor: 'pointer', fontFamily: 'inherit',
      whiteSpace: 'nowrap',
    });
    const countStyle = (active) => ({
      fontSize: 10, fontWeight: 700,
      color: active ? '#ffffffcc' : pal.textFaint,
      fontVariantNumeric: 'tabular-nums',
    });

    const inputStyle = {
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
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        background: pal.card,
        border: `1px solid ${pal.border}`,
        borderRadius: 10,
        padding: 10,
      }}>
        {/* Quick filter chips — most common slices at one click. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {currentUser && (
            <button
              onClick={() => setFilter('owner', myActive ? 'all' : currentUser.id)}
              title={myActive ? 'Showing only your tasks. Click to clear.' : 'Show only tasks assigned to you.'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 26, padding: '0 10px 0 4px',
                background: myActive ? pal.accent : 'transparent',
                color: myActive ? '#fff' : pal.textSoft,
                border: `1px solid ${myActive ? pal.accent : pal.border}`,
                borderRadius: 14,
                fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
              <OwnerAvatar id={currentUser.id} size={18} ring={myActive ? pal.accent : pal.card} />
              My tasks
              <span style={countStyle(myActive)}>{chipCounts.mine}</span>
            </button>
          )}
          <span style={{ width: 1, height: 18, background: pal.border, margin: '0 2px' }} />
          <button onClick={setAll} style={chipStyle(allActive, null)}>All</button>
          <button onClick={() => setQuickDue('overdue')} style={chipStyle(filters.due === 'overdue', '#E76B5D')}>
            Overdue <span style={countStyle(filters.due === 'overdue')}>{chipCounts.overdue}</span>
          </button>
          <button onClick={() => setQuickDue('today')} style={chipStyle(filters.due === 'today', '#C98A2C')}>
            Due today <span style={countStyle(filters.due === 'today')}>{chipCounts.today}</span>
          </button>
          <button onClick={() => setQuickDue('week')} style={chipStyle(filters.due === 'week', null)}>
            This week <span style={countStyle(filters.due === 'week')}>{chipCounts.week}</span>
          </button>
          <button onClick={setAttention} style={chipStyle(attentionActive, '#C98A2C')}>
            Needs attention <span style={countStyle(attentionActive)}>{chipCounts.attention}</span>
          </button>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.7fr .9fr .9fr .9fr 1fr .9fr auto',
          gap: 8,
          alignItems: 'center',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 10px', background: pal.cardAlt, border: `1px solid ${pal.border}`, borderRadius: 7 }}>
          <Icon name="search" size={14} color={pal.textFaint} />
          <input
            value={filters.q}
            onChange={(e) => setFilter('q', e.target.value)}
            placeholder="Search title, notes, link, category"
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: pal.text, outline: 'none', fontSize: 12.5, fontFamily: 'inherit' }}
          />
        </div>
        <select style={inputStyle} value={filters.owner} onChange={(e) => setFilter('owner', e.target.value)}>
          <option value="all">All owners</option>
          <option value="unassigned">Unassigned</option>
          {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select style={inputStyle} value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="open">Open</option>
          <option value="all">All status</option>
          <option value="todo">To Do</option>
          <option value="doing">Doing</option>
          <option value="attention">Needs attention</option>
          <option value="done">Done</option>
        </select>
        <select style={inputStyle} value={filters.priority} onChange={(e) => setFilter('priority', e.target.value)}>
          <option value="all">All priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select style={inputStyle} value={filters.label} onChange={(e) => setFilter('label', e.target.value)}>
          <option value="all">All categories</option>
          {window.RCIS_DATA.LABELS.map((label) => <option key={label} value={label}>{label}</option>)}
        </select>
        <select style={inputStyle} value={filters.due} onChange={(e) => setFilter('due', e.target.value)}>
          <option value="all">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="none">No due date</option>
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
      </div>
    );
  }

  function TaskColumn({ column, items, pal, isOver, onAdd, onOpen, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop, dragId }) {
    const meta = STATUS[column];
    return (
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 10,
          borderRadius: 8,
          background: isOver ? pal.accentSoft : pal.cardAlt,
          border: `1.5px ${isOver ? 'dashed' : 'solid'} ${isOver ? pal.accent : pal.borderSoft}`,
          minHeight: 520,
          transition: 'background .12s, border-color .12s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: meta.color }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: pal.textSoft, textTransform: 'uppercase', letterSpacing: 0.6 }}>{meta.label}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: pal.textFaint, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{items.length}</span>
          <button onClick={onAdd} title={`Add to ${meta.label}`} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            padding: 0,
            background: 'transparent',
            color: pal.textFaint,
            border: `1px solid ${pal.border}`,
            borderRadius: 5,
            cursor: 'pointer',
          }}>
            <Icon name="plus" size={11} stroke={2.4} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {items.map((todo) => (
            <TaskCard
              key={todo.id}
              todo={todo}
              pal={pal}
              onOpen={() => onOpen(todo)}
              onDragStart={(e) => onDragStart(e, todo.id)}
              onDragEnd={onDragEnd}
              isDragging={dragId === todo.id}
            />
          ))}
          {items.length === 0 && (
            <div style={{
              padding: '18px 10px',
              textAlign: 'center',
              fontSize: 11,
              color: pal.textFaint,
              border: `1px dashed ${pal.border}`,
              borderRadius: 7,
            }}>No matching tasks</div>
          )}
        </div>
      </div>
    );
  }

  function TaskCard({ todo, pal, onOpen, onDragStart, onDragEnd, isDragging }) {
    const due = dueMeta(todo);
    const hasNotes = todo.notes && todo.notes.trim();
    const hasFiles = todo.attachments && todo.attachments.length > 0;
    const commentCount = window.useTaskCommentCount ? window.useTaskCommentCount(todo.id) : 0;
    return (
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onOpen}
        style={{
          padding: '9px 10px',
          background: pal.card,
          border: `1px solid ${pal.border}`,
          borderLeft: `3px solid ${PRIO[todo.priority] || PRIO.medium}`,
          borderRadius: 7,
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
          cursor: 'grab',
          opacity: isDragging ? 0.45 : 1,
          boxShadow: '0 1px 2px rgba(0,0,0,.04)',
        }}
      >
        <div style={{
          color: pal.text,
          fontSize: 12.8,
          fontWeight: 600,
          lineHeight: 1.35,
          textDecoration: todo.column === 'done' ? 'line-through' : 'none',
          opacity: todo.column === 'done' ? 0.65 : 1,
        }}>{todo.title}</div>

        {todo.linkedTo && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            maxWidth: '100%',
            alignSelf: 'flex-start',
            padding: '2px 6px',
            background: pal.chipBg,
            borderRadius: 4,
            color: pal.textSoft,
            fontSize: 10.5,
          }}>
            <window.LinkTypeBadge type={todo.linkedTo.type} pal={pal} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {window.resolveLinkedName ? window.resolveLinkedName(todo.linkedTo) : todo.linkedTo.name}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10.5, color: pal.textSoft, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: pal.chipBg }}>{todo.label}</span>
          {due.label && (
            <span style={{ fontSize: 10.5, color: due.tone, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{due.label}</span>
          )}
          {(hasNotes || hasFiles || commentCount > 0) && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: pal.textFaint }}>
              {hasNotes && <Icon name="list" size={11} stroke={2} />}
              {hasFiles && <Icon name="file" size={11} stroke={2} />}
              {commentCount > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10.5, fontWeight: 600 }}>
                  <Icon name="msg" size={11} stroke={2} />{commentCount}
                </span>
              )}
            </span>
          )}
          <span style={{ marginLeft: 'auto', display: 'flex' }}>
            {todo.owners.length === 0 ? (
              <span style={{ color: pal.textFaint, fontSize: 10, fontStyle: 'italic' }}>unassigned</span>
            ) : (
              todo.owners.map((id, index) => (
                <span key={id} style={{ marginLeft: index === 0 ? 0 : -5 }}>
                  <OwnerAvatar id={id} size={18} ring={pal.card} />
                </span>
              ))
            )}
          </span>
        </div>
      </div>
    );
  }

  function FocusPanel({ pal, team, todos, onOpen }) {
    const overdue = React.useMemo(() => todos
      .filter((t) => t.column !== 'done' && isOverdue(t.due))
      .sort(sortTasks)
      .slice(0, 6), [todos]);
    const dueToday = React.useMemo(() => todos
      .filter((t) => t.column !== 'done' && isToday(t.due))
      .sort(sortTasks)
      .slice(0, 6), [todos]);
    const unassigned = React.useMemo(() => todos
      .filter((t) => t.column !== 'done' && (!t.owners || t.owners.length === 0))
      .sort(sortTasks)
      .slice(0, 6), [todos]);
    const ownerCounts = React.useMemo(() => {
      return team.map((m) => ({
        ...m,
        count: todos.filter((t) => t.column !== 'done' && t.owners && t.owners.includes(m.id)).length,
      }));
    }, [todos, team]);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SideCard pal={pal} title="Owner load">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ownerCounts.map((m) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <OwnerAvatar id={m.id} size={24} />
                <span style={{ flex: 1, color: pal.text, fontSize: 12.5, fontWeight: 600 }}>{m.name.split(' ')[0]}</span>
                <span style={{ color: pal.textSoft, fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{m.count}</span>
              </div>
            ))}
          </div>
        </SideCard>

        <SideCard pal={pal} title="Overdue" count={overdue.length}>
          <MiniList pal={pal} todos={overdue} onOpen={onOpen} empty="Nothing overdue." />
        </SideCard>

        <SideCard pal={pal} title="Due today" count={dueToday.length}>
          <MiniList pal={pal} todos={dueToday} onOpen={onOpen} empty="Nothing due today." />
        </SideCard>

        <SideCard pal={pal} title="Unassigned" count={unassigned.length}>
          <MiniList pal={pal} todos={unassigned} onOpen={onOpen} empty="No open unassigned tasks." />
        </SideCard>
      </div>
    );
  }

  function SideCard({ pal, title, count, children }) {
    return (
      <div style={{ background: pal.card, border: `1px solid ${pal.border}`, borderRadius: 10, padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 10 }}>
          <div style={{ color: pal.text, fontSize: 13, fontWeight: 700 }}>{title}</div>
          {typeof count === 'number' && <span style={{ color: pal.textFaint, fontSize: 11, fontWeight: 700 }}>{count}</span>}
        </div>
        {children}
      </div>
    );
  }

  function MiniList({ pal, todos, onOpen, empty }) {
    if (!todos.length) {
      return <div style={{ color: pal.textFaint, fontSize: 12, lineHeight: 1.4 }}>{empty}</div>;
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {todos.map((todo) => {
          const due = dueMeta(todo);
          return (
            <button key={todo.id} onClick={() => onOpen(todo)} style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              width: '100%',
              textAlign: 'left',
              padding: '7px 8px',
              background: pal.cardAlt,
              border: `1px solid ${pal.borderSoft}`,
              borderRadius: 7,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}>
              <span style={{ color: pal.text, fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>{todo.title}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: pal.textFaint, fontSize: 10.5 }}>
                <span style={{ color: due.tone, fontWeight: 700 }}>{due.label || STATUS[todo.column].label}</span>
                <span>{todo.label}</span>
                <span style={{ marginLeft: 'auto', display: 'flex' }}>
                  {todo.owners.map((id, index) => (
                    <span key={id} style={{ marginLeft: index === 0 ? 0 : -5 }}>
                      <OwnerAvatar id={id} size={16} ring={pal.cardAlt} />
                    </span>
                  ))}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  function summarize(todos) {
    return {
      open: todos.filter((t) => t.column !== 'done').length,
      overdue: todos.filter((t) => t.column !== 'done' && isOverdue(t.due)).length,
      dueSoon: todos.filter((t) => t.column !== 'done' && isDueThisWeek(t.due)).length,
      unassigned: todos.filter((t) => t.column !== 'done' && (!t.owners || t.owners.length === 0)).length,
      doneThisWeek: todos.filter((t) => t.column === 'done' && wasCompletedThisWeek(t)).length,
    };
  }

  function matchesFilters(todo, filters) {
    if (filters.status === 'open' && todo.column === 'done') {
      const when = todo.completedAt || todo.updatedAt || 0;
      const cutoff = Date.now() - RECENT_DONE_DAYS * 24 * 60 * 60 * 1000;
      if (when < cutoff) return false;
    }
    if (filters.status !== 'all' && filters.status !== 'open' && todo.column !== filters.status) return false;
    if (filters.owner === 'unassigned' && todo.owners.length > 0) return false;
    if (filters.owner !== 'all' && filters.owner !== 'unassigned' && !todo.owners.includes(filters.owner)) return false;
    if (filters.priority !== 'all' && todo.priority !== filters.priority) return false;
    if (filters.label !== 'all' && todo.label !== filters.label) return false;
    if (filters.due === 'overdue' && !isOverdue(todo.due)) return false;
    if (filters.due === 'today' && !isToday(todo.due)) return false;
    if (filters.due === 'week' && !isDueThisWeek(todo.due)) return false;
    if (filters.due === 'none' && todo.due) return false;

    const q = filters.q.trim().toLowerCase();
    if (!q) return true;
    const haystack = [
      todo.title,
      todo.notes,
      todo.label,
      todo.priority,
      todo.linkedTo && todo.linkedTo.name,
      todo.linkedTo && todo.linkedTo.type,
      ...(todo.owners || []).map((id) => teamMember(id).name),
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q);
  }

  function sortTasks(a, b) {
    if (a.column === 'done' && b.column !== 'done') return 1;
    if (a.column !== 'done' && b.column === 'done') return -1;
    const ad = a.due ? dateValue(a.due) : Number.MAX_SAFE_INTEGER;
    const bd = b.due ? dateValue(b.due) : Number.MAX_SAFE_INTEGER;
    if (ad !== bd) return ad - bd;
    const pr = { high: 0, medium: 1, low: 2 };
    if (pr[a.priority] !== pr[b.priority]) return pr[a.priority] - pr[b.priority];
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  }

  function dueMeta(todo) {
    if (!todo.due) return { label: null, tone: '#7A8290' };
    const label = formatDue(todo.due);
    if (todo.column === 'done') return { label, tone: '#7A8290' };
    if (isOverdue(todo.due)) return { label: `${label} overdue`, tone: '#E76B5D' };
    if (isToday(todo.due)) return { label: `${label} today`, tone: '#C98A2C' };
    return { label, tone: '#7A8290' };
  }

  function formatDue(iso) {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    if (!y) return null;
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function dateValue(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  }
  function todayValue() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.getTime();
  }
  function isToday(iso) {
    if (!iso) return false;
    return dateValue(iso) === todayValue();
  }
  function isOverdue(iso) {
    if (!iso) return false;
    return dateValue(iso) < todayValue();
  }
  function isDueThisWeek(iso) {
    if (!iso) return false;
    const val = dateValue(iso);
    const today = todayValue();
    const seven = today + 7 * 24 * 60 * 60 * 1000;
    return val >= today && val <= seven;
  }
  function wasCompletedThisWeek(todo) {
    const value = todo.completedAt || (todo.column === 'done' ? todo.updatedAt : null);
    if (!value) return false;
    return value >= todayValue() - 7 * 24 * 60 * 60 * 1000;
  }

  window.TasksPage = TasksPage;
})();
