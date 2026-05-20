// DocumentsStore — Supabase-backed, keyed by (scope, scope_id).
// Same pattern as TodosStore/ContactsStore: load on auth in, realtime,
// optimistic updates + localStorage cache.
//
// Each row is either a link (url set) or an upload (storage_path set).
// Uploads share the `task-attachments` bucket; we generate signed URLs
// on the fly when the user clicks them.

window.DocumentsStore = (() => {
  const CACHE_KEY = 'rcis.docs.cache.v3';
  const TABLE = 'documents';

  function uid() {
    return 'doc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }
  function fromRow(r) {
    return {
      id: r.id, scope: r.scope, scopeId: r.scope_id,
      kind: r.kind, url: r.url || '', name: r.name,
      storagePath: r.storage_path || null,
      size: r.size != null ? Number(r.size) : null,
      mime: r.mime || null,
      source: r.source || 'link',
      addedAt: new Date(r.added_at).getTime(),
    };
  }
  function toRow(d) {
    return {
      id: d.id, scope: d.scope, scope_id: d.scopeId,
      kind: d.kind, url: d.url || null, name: d.name,
      storage_path: d.storagePath || null,
      size: d.size != null ? d.size : null,
      mime: d.mime || null,
      source: d.source || 'link',
    };
  }

  let state = [];
  try { state = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); } catch (e) {}

  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn(state));
  function setState(next) {
    state = next;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(state)); } catch (e) {}
    emit();
  }

  async function load() {
    if (!window.sb) return;
    const { data, error } = await window.sb.from(TABLE).select('*');
    if (error) { console.warn('docs load failed', error); return; }
    setState((data || []).map(fromRow));
  }

  let channel = null;
  function subscribeRealtime() {
    if (!window.sb || channel) return;
    channel = window.sb.channel('rcis-docs')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setState(state.filter((d) => d.id !== payload.old.id));
        } else if (payload.eventType === 'INSERT') {
          const row = fromRow(payload.new);
          if (!state.find((d) => d.id === row.id)) setState([...state, row]);
        } else if (payload.eventType === 'UPDATE') {
          const row = fromRow(payload.new);
          setState(state.map((d) => d.id === row.id ? row : d));
        }
      })
      .subscribe();
  }

  function boot() {
    if (!window.sb) return;
    window.sb.auth.getSession().then(({ data }) => {
      if (data.session) { load(); subscribeRealtime(); }
    });
    window.sb.auth.onAuthStateChange((event, session) => {
      if (session) { load(); subscribeRealtime(); }
      else {
        if (channel) { window.sb.removeChannel(channel); channel = null; }
        setState([]);
      }
    });
  }
  if (window.sb) boot(); else setTimeout(boot, 0);

  return {
    get() { return state; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    forScope(scope, scopeId) {
      return state.filter((d) => d.scope === scope && d.scopeId === scopeId);
    },

    async add({ scope, scopeId, kind, url, name }) {
      const d = {
        id: uid(), scope, scopeId,
        kind, url, name,
        storagePath: null, size: null, mime: null, source: 'link',
        addedAt: Date.now(),
      };
      setState([...state, d]);
      const { error } = await window.sb.from(TABLE).insert(toRow(d));
      if (error) console.warn('docs.add', error);
      return d;
    },

    // Upload a file and create a documents row pointing at the storage path.
    async addUpload({ scope, scopeId, file, name }) {
      const helpers = window.attachmentHelpers;
      if (!helpers || !helpers.uploadAttachmentFile) {
        throw new Error('Upload helpers not loaded.');
      }
      const problem = helpers.validateUpload ? helpers.validateUpload(file) : null;
      if (problem) throw new Error(problem);
      // uploadAttachmentFile returns an attachment-shaped object with
      // { id, kind, name, storagePath, size, mime, addedAt, source: 'upload' }
      const att = await helpers.uploadAttachmentFile(file);
      const d = {
        id: uid(),
        scope, scopeId,
        kind: att.kind,
        url: null,
        name: (name || att.name).trim() || att.name,
        storagePath: att.storagePath,
        size: att.size,
        mime: att.mime,
        source: 'upload',
        addedAt: Date.now(),
      };
      setState([...state, d]);
      const { error } = await window.sb.from(TABLE).insert(toRow(d));
      if (error) {
        console.warn('docs.addUpload', error);
        // best-effort: leave the file in storage so a retry can resume.
      }
      return d;
    },

    async remove(id) {
      const existing = state.find((d) => d.id === id);
      setState(state.filter((d) => d.id !== id));
      const { error } = await window.sb.from(TABLE).delete().eq('id', id);
      if (error) console.warn('docs.remove', error);
      if (existing && existing.storagePath && window.attachmentHelpers &&
          window.attachmentHelpers.deleteAttachmentFile) {
        await window.attachmentHelpers.deleteAttachmentFile({
          storagePath: existing.storagePath,
        });
      }
    },

    // Helper for an upload-flavored doc — generates a signed URL via the
    // shared attachment helpers and opens it.
    async open(doc) {
      if (doc.source === 'upload' && doc.storagePath) {
        if (window.attachmentHelpers && window.attachmentHelpers.openUploadedAttachment) {
          await window.attachmentHelpers.openUploadedAttachment(doc);
          return;
        }
      }
      if (doc.url) window.open(doc.url, '_blank', 'noreferrer');
    },

    reload: load,
  };
})();

window.useDocuments = function useDocuments(scope, scopeId) {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => window.DocumentsStore.subscribe(force), []);
  return window.DocumentsStore.forScope(scope, scopeId);
};
