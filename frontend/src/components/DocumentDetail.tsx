import { useState } from 'react';
import { Document, User, AuditLog, DocumentStatus, api } from '../api/client';
import { DocumentHistory } from './DocumentHistory';

interface Props {
  doc: Document;
  currentUser: User;
  history: AuditLog[];
  historyLoading: boolean;
  onUpdated: (doc: Document) => void;
  onEdit: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

type DocumentStatusWithAll = DocumentStatus;

const STATUS_LABEL: Record<DocumentStatusWithAll, string> = {
  draft: 'Draft',
  submitted: 'In Review',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
  archived: 'Archived',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

/**
 * Determine which action buttons to show for a given (status, user role, ownership) combo.
 * Mirrors the server-side transition table — purely for UX (server still enforces).
 */
function getAvailableActions(doc: Document, user: User): string[] {
  const isOwner = doc.authorId === user.id;
  const actions: string[] = [];

  if (doc.status === 'archived') return [];

  switch (doc.status) {
    case 'draft':
      if (isOwner && (user.role === 'author' || user.role === 'admin')) {
        actions.push('submit');
      }
      if (user.role === 'admin') actions.push('archive');
      break;

    case 'submitted':
      if (!isOwner && (user.role === 'reviewer' || user.role === 'admin')) {
        actions.push('approve', 'reject');
      }
      if (user.role === 'admin') actions.push('archive');
      break;

    case 'approved':
      if (user.role === 'reviewer' || user.role === 'admin') {
        actions.push('publish');
      }
      if (user.role === 'admin') actions.push('archive');
      break;

    case 'rejected':
      if (isOwner && (user.role === 'author' || user.role === 'admin')) {
        actions.push('reopen');
      }
      break;

    case 'published':
      if (user.role === 'admin') actions.push('archive');
      break;
  }

  return actions;
}

const ACTION_CONFIG: Record<string, { label: string; btnClass: string; icon: string }> = {
  submit:  { label: 'Submit for Review', btnClass: 'btn-warning', icon: '→' },
  approve: { label: 'Approve',           btnClass: 'btn-success', icon: '✓' },
  reject:  { label: 'Reject',            btnClass: 'btn-danger',  icon: '✕' },
  reopen:  { label: 'Reopen as Draft',   btnClass: 'btn-purple',  icon: '↩' },
  publish: { label: 'Publish',           btnClass: 'btn-success', icon: '★' },
  archive: { label: 'Archive',           btnClass: 'btn-ghost',   icon: '⬛' },
};

export function DocumentDetail({
  doc,
  currentUser,
  history,
  historyLoading,
  onUpdated,
  onEdit,
  onError,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [activeTab, setActiveTab] = useState<'detail' | 'history'>('detail');

  const availableActions = getAvailableActions(doc, currentUser);
  const canEdit =
    (doc.status === 'draft' || doc.status === 'rejected') &&
    doc.authorId === currentUser.id &&
    doc.status !== 'archived';

  async function handleAction(action: string) {
    if (action === 'reject') {
      setShowRejectForm(true);
      return;
    }

    setLoading(action);
    try {
      const updated = await api.transition(doc.id, action, currentUser.id, {
        expectedVersion: doc.version,
      });
      onUpdated(updated);
      onSuccess(`Document ${action}ed successfully`);
    } catch (err: any) {
      onError(err.message || 'Action failed');
    } finally {
      setLoading(null);
    }
  }

  async function handleReject() {
    if (!rejectComment.trim()) {
      onError('Rejection comment is required');
      return;
    }
    setLoading('reject');
    try {
      const updated = await api.transition(doc.id, 'reject', currentUser.id, {
        expectedVersion: doc.version,
        comment: rejectComment.trim(),
      });
      onUpdated(updated);
      onSuccess('Document rejected');
      setShowRejectForm(false);
      setRejectComment('');
    } catch (err: any) {
      onError(err.message || 'Rejection failed');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="doc-detail">
      {/* Header */}
      <div className="doc-detail-header">
        <div className="doc-title">{doc.title}</div>
        <div className="doc-meta-row">
          <span className={`badge badge-${doc.status}`}>{STATUS_LABEL[doc.status]}</span>
          <span>By {doc.author?.name ?? 'Unknown'}</span>
          <span>·</span>
          <span>Updated {formatDate(doc.updatedAt)}</span>
          <span>·</span>
          <span>v{doc.version}</span>
        </div>
      </div>

      {/* Rejection Banner */}
      {doc.status === 'rejected' && doc.rejectionComment && (
        <div className="rejection-banner">
          <svg className="rejection-banner-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <div className="rejection-banner-label">Rejection Reason</div>
            <div className="rejection-banner-text">{doc.rejectionComment}</div>
          </div>
        </div>
      )}

      {/* Actions */}
      {(availableActions.length > 0 || canEdit) && (
        <div className="actions-panel">
          <div className="actions-title">Actions</div>
          <div className="actions-row">
            {canEdit && (
              <button className="btn btn-ghost btn-sm" onClick={onEdit} id="btn-edit-document">
                ✎ Edit
              </button>
            )}
            {availableActions
              .filter((a) => a !== 'reject' || !showRejectForm)
              .map((action) => {
                const cfg = ACTION_CONFIG[action];
                return (
                  <button
                    key={action}
                    className={`btn btn-sm ${cfg.btnClass}`}
                    disabled={loading !== null}
                    onClick={() => handleAction(action)}
                    id={`btn-action-${action}`}
                  >
                    {loading === action ? (
                      <span className="spinner" style={{ width: 14, height: 14 }} />
                    ) : cfg.icon}{' '}
                    {cfg.label}
                  </button>
                );
              })}
          </div>

          {/* Reject form */}
          {showRejectForm && (
            <div className="reject-form">
              <textarea
                className="form-textarea"
                style={{ minHeight: 80 }}
                placeholder="Rejection reason (required)..."
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                id="input-reject-comment"
              />
              <div className="actions-row">
                <button
                  className="btn btn-danger btn-sm"
                  disabled={loading === 'reject'}
                  onClick={handleReject}
                  id="btn-confirm-reject"
                >
                  {loading === 'reject' ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '✕'} Confirm Reject
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setShowRejectForm(false); setRejectComment(''); }}
                  id="btn-cancel-reject"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {(['detail', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${activeTab === tab ? 'var(--accent)' : 'transparent'}`,
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: activeTab === tab ? 600 : 400,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.15s',
              marginBottom: -1,
            }}
            id={`tab-${tab}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'detail' ? (
        <div className="doc-body">{doc.body}</div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <DocumentHistory logs={history} loading={historyLoading} />
        </div>
      )}
    </div>
  );
}
