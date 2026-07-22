import { useEffect, useState, useCallback } from 'react';
import { api } from './api/client';
import type { User, Document, AuditLog } from './api/client';
import { UserSwitcher } from './components/UserSwitcher';
import { DocumentList } from './components/DocumentList';
import { DocumentDetail } from './components/DocumentDetail';
import { DocumentForm } from './components/DocumentForm';
import './index.css';

type View = 'list' | 'detail' | 'new' | 'edit';

interface Toast {
  id: number;
  type: 'error' | 'success';
  message: string;
}

let toastCounter = 0;

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [history, setHistory] = useState<AuditLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [view, setView] = useState<View>('list');
  const [docsLoading, setDocsLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  // ── Load users on mount ──────────────────────────────────────────────────
  useEffect(() => {
    api.getUsers().then((u) => {
      setUsers(u);
      setCurrentUser(u[0] ?? null); // Default: alice (author)
    });
  }, []);

  // ── Load documents when user changes ────────────────────────────────────
  const loadDocuments = useCallback(async () => {
    if (!currentUser) return;
    setDocsLoading(true);
    try {
      const docs = await api.getDocuments(currentUser.id, currentUser.role === 'admin' && showArchived);
      setDocuments(docs);
    } catch {
      showToast('error', 'Failed to load documents');
    } finally {
      setDocsLoading(false);
    }
  }, [currentUser, showArchived]);

  useEffect(() => {
    loadDocuments();
    setSelectedDoc(null);
    setView('list');
  }, [currentUser, showArchived]);

  useEffect(() => {
    if (currentUser?.role !== 'admin' && showArchived) {
      setShowArchived(false);
    }
  }, [currentUser, showArchived]);

  // ── Load history when doc selected ──────────────────────────────────────
  useEffect(() => {
    if (!selectedDoc || !currentUser) return;
    setHistoryLoading(true);
    api.getHistory(selectedDoc.id, currentUser.id)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [selectedDoc?.id, currentUser]);

  // ── Toast helpers ────────────────────────────────────────────────────────
  function showToast(type: 'error' | 'success', message: string) {
    const id = ++toastCounter;
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleSelectDoc(doc: Document) {
    setSelectedDoc(doc);
    setView('detail');
  }

  function handleDocUpdated(updated: Document) {
    setSelectedDoc(updated);
    setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    // Refresh history
    if (currentUser) {
      setHistoryLoading(true);
      api.getHistory(updated.id, currentUser.id)
        .then(setHistory)
        .catch(() => {})
        .finally(() => setHistoryLoading(false));
    }
    loadDocuments();
  }

  async function handleFormSaved(doc: Document) {
    await loadDocuments();
    setSelectedDoc(doc);
    setView('detail');
    showToast('success', view === 'new' ? 'Document created' : 'Document saved');
  }

  return (
    <div className="app">
      {/* Top Bar */}
      <header className="topbar">
        <div className="topbar-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10,9 9,9 8,9"/>
          </svg>
          DocFlow
        </div>
        <div className="topbar-spacer" />
        {currentUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            <div
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--accent)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 12,
              }}
            >
              {currentUser.name[0]}
            </div>
            <span style={{ color: 'var(--text-secondary)' }}>
              {currentUser.name}
              <span style={{ color: 'var(--accent)', marginLeft: 6, fontSize: 11 }}>
                {currentUser.role}
              </span>
            </span>
          </div>
        )}
      </header>

      {/* Main Layout */}
      <div className="main-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <UserSwitcher
            users={users}
            currentUser={currentUser}
            onSelect={(u) => setCurrentUser(u)}
          />
          <div className="divider" />
          <div className="section-label">Documents</div>
          {currentUser?.role === 'admin' && (
            <label className="sidebar-checkbox">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Show archived
            </label>
          )}
          {docsLoading ? (
            <div className="loading-center" style={{ padding: 24 }}>
              <div className="spinner" />
            </div>
          ) : (
            <DocumentList
              documents={documents}
              selectedId={selectedDoc?.id ?? null}
              onSelect={handleSelectDoc}
              onNew={() => { setSelectedDoc(null); setView('new'); }}
              currentUserRole={currentUser?.role ?? 'viewer'}
            />
          )}
        </aside>

        {/* Main Content */}
        <main className="content">
          {view === 'new' && currentUser && (
            <DocumentForm
              userId={currentUser.id}
              onSaved={handleFormSaved}
              onCancel={() => setView(selectedDoc ? 'detail' : 'list')}
              onError={(msg) => showToast('error', msg)}
            />
          )}

          {view === 'edit' && currentUser && selectedDoc && (
            <DocumentForm
              userId={currentUser.id}
              existingDoc={selectedDoc}
              onSaved={handleFormSaved}
              onCancel={() => setView('detail')}
              onError={(msg) => showToast('error', msg)}
            />
          )}

          {view === 'detail' && selectedDoc && currentUser && (
            <DocumentDetail
              doc={selectedDoc}
              currentUser={currentUser}
              history={history}
              historyLoading={historyLoading}
              onUpdated={handleDocUpdated}
              onEdit={() => setView('edit')}
              onError={(msg) => showToast('error', msg)}
              onSuccess={(msg) => showToast('success', msg)}
            />
          )}

          {view === 'list' && !docsLoading && (
            <div className="placeholder-panel">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ opacity: 0.2 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
              </svg>
              <h2>Select a document</h2>
              <p>Choose a document from the sidebar, or create a new one to get started.</p>
            </div>
          )}
        </main>
      </div>

      {/* Toasts */}
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
