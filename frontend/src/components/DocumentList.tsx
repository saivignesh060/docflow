import type { Document, DocumentStatus } from '../api/client';

interface Props {
  documents: Document[];
  selectedId: string | null;
  onSelect: (doc: Document) => void;
  onNew: () => void;
  currentUserRole: string;
}

const STATUS_LABEL: Record<DocumentStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
  archived: 'Archived',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function DocumentList({ documents, selectedId, onSelect, onNew, currentUserRole }: Props) {
  const canCreate = currentUserRole === 'author';

  return (
    <div className="card" style={{ padding: '16px' }}>
      <div className="card-header">
        <span className="card-title">Documents</span>
        {canCreate && (
          <button className="btn btn-primary btn-sm" onClick={onNew} id="btn-new-document">
            + New
          </button>
        )}
      </div>

      {documents.length === 0 ? (
        <div className="empty-state" style={{ padding: '32px 16px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
          </svg>
          <p>No documents visible to your role</p>
        </div>
      ) : (
        <div className="doc-list">
          {documents.map((doc) => (
            <button
              key={doc.id}
              className={`doc-item ${selectedId === doc.id ? 'selected' : ''}`}
              onClick={() => onSelect(doc)}
              id={`doc-item-${doc.id}`}
            >
              <div className="doc-item-body">
                <div className="doc-item-title">{doc.title}</div>
                <div className="doc-item-meta">
                  {doc.author?.name ?? 'Unknown'} · {timeAgo(doc.updatedAt)}
                </div>
              </div>
              <span className={`badge badge-${doc.status}`}>{STATUS_LABEL[doc.status]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
