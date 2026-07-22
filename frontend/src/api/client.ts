const API_BASE = 'http://localhost:3001/api';

// ── Types ──────────────────────────────────────────────────────────────────

export type Role = 'viewer' | 'author' | 'reviewer' | 'admin';
export type DocumentStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'published' | 'archived';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Document {
  id: string;
  title: string;
  body: string;
  status: DocumentStatus;
  authorId: string;
  author?: User;
  version: number;
  rejectionComment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  documentId: string;
  actorId: string;
  actor?: User;
  action: string;
  fromStatus: DocumentStatus | null;
  toStatus: DocumentStatus | null;
  comment: string | null;
  timestamp: string;
}

// ── API Client ─────────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  userId: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const err = new Error(body.error || 'Request failed') as Error & { status: number };
    err.status = res.status;
    throw err;
  }

  return res.json();
}

export const api = {
  // Users
  getUsers: (): Promise<User[]> =>
    fetch(`${API_BASE}/users`).then((r) => r.json()),

  // Documents
  getDocuments: (userId: string, includeArchived = false): Promise<Document[]> =>
    request(`/documents${includeArchived ? '?includeArchived=true' : ''}`, userId),

  getDocument: (id: string, userId: string): Promise<Document> =>
    request(`/documents/${id}`, userId),

  getHistory: (id: string, userId: string): Promise<AuditLog[]> =>
    request(`/documents/${id}/history`, userId),

  createDocument: (data: { title: string; body: string }, userId: string): Promise<Document> =>
    request('/documents', userId, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  editDocument: (
    id: string,
    data: { title?: string; body?: string; expectedVersion: number },
    userId: string
  ): Promise<Document> =>
    request(`/documents/${id}`, userId, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Transitions
  transition: (
    id: string,
    action: string,
    userId: string,
    payload: { expectedVersion: number; comment?: string } = { expectedVersion: 0 }
  ): Promise<Document> =>
    request(`/documents/${id}/${action}`, userId, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
