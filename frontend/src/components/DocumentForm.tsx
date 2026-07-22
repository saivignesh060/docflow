import { useState } from 'react';
import { Document, api } from '../api/client';

interface Props {
  userId: string;
  existingDoc?: Document | null; // if provided, edit mode
  onSaved: (doc: Document) => void;
  onCancel: () => void;
  onError: (msg: string) => void;
}

export function DocumentForm({ userId, existingDoc, onSaved, onCancel, onError }: Props) {
  const isEdit = !!existingDoc;
  const [title, setTitle] = useState(existingDoc?.title ?? '');
  const [body, setBody] = useState(existingDoc?.body ?? '');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) { onError('Title is required'); return; }
    if (!body.trim())  { onError('Body is required');  return; }

    setLoading(true);
    try {
      let saved: Document;
      if (isEdit && existingDoc) {
        saved = await api.editDocument(
          existingDoc.id,
          { title, body, expectedVersion: existingDoc.version },
          userId
        );
      } else {
        saved = await api.createDocument({ title, body }, userId);
      }
      onSaved(saved);
    } catch (err: any) {
      onError(err.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{isEdit ? 'Edit Document' : 'New Document'}</span>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="doc-title">Title</label>
          <input
            id="doc-title"
            type="text"
            className="form-input"
            placeholder="Document title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="doc-body">Body</label>
          <textarea
            id="doc-body"
            className="form-textarea"
            placeholder="Document content..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={loading}
            style={{ minHeight: 200 }}
          />
        </div>
        <div className="actions-row">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            id="btn-save-document"
          >
            {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null}
            {isEdit ? 'Save Changes' : 'Create Draft'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={loading}
            id="btn-cancel-form"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
