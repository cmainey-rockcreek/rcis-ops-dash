// NotesSection — shared free-text notes card used by contractor / district /
// school detail pages. Backed by NotesStore (Supabase entity_notes table).

(function () {
  function NotesSection({ pal, scope, scopeId, placeholder }) {
    const [notes, setNotes] = window.useEntityNotes(scope, scopeId);
    return (
      <div style={{
        background: pal.card, border: `1px solid ${pal.border}`,
        borderRadius: 10, padding: 16,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: pal.text }}>Notes</h3>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={placeholder || 'Anything worth writing down — context, history, quirks…'}
          style={{
            width: '100%', minHeight: 90, resize: 'vertical',
            padding: '8px 10px',
            border: `1px solid ${pal.border}`, borderRadius: 7,
            background: pal.cardAlt, color: pal.text,
            fontSize: 12.5, fontFamily: 'inherit', lineHeight: 1.45,
            outline: 'none',
          }}
        />
        <div style={{ fontSize: 10.5, color: pal.textFaint, marginTop: -4 }}>
          Shared with the team — saves automatically.
        </div>
      </div>
    );
  }
  window.NotesSection = NotesSection;
})();
