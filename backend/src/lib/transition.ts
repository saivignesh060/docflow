import { Document, DocumentStatus, AuditAction, User } from '../db/schema';

// ── Transition Table ───────────────────────────────────────────────────────
//
// This is the single source of truth for all valid state transitions.
// Every mutating endpoint MUST call transition() — no direct status mutation.
//
// Key: `${fromStatus}:${action}`
// Value: validation function that returns the new status or throws.

export type TransitionAction =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'reopen'
  | 'publish'
  | 'archive';

export class TransitionError extends Error {
  constructor(
    message: string,
    public statusCode: number = 422
  ) {
    super(message);
    this.name = 'TransitionError';
  }
}

interface TransitionResult {
  newStatus: DocumentStatus;
  auditAction: AuditAction;
}

type TransitionValidator = (
  doc: Document,
  actor: User,
  comment?: string
) => TransitionResult;

const TRANSITION_TABLE: Record<string, TransitionValidator> = {
  // draft → submitted (owner author only)
  'draft:submit': (doc, actor) => {
    if (actor.role !== 'author') {
      throw new TransitionError('Only authors can submit documents', 403);
    }
    if (doc.authorId !== actor.id) {
      throw new TransitionError('Only the document owner can submit it', 403);
    }
    return { newStatus: 'submitted', auditAction: 'submitted' };
  },

  // submitted → approved (reviewer/admin, not the owner)
  'submitted:approve': (doc, actor) => {
    if (actor.role !== 'reviewer' && actor.role !== 'admin') {
      throw new TransitionError('Only reviewers or admins can approve documents', 403);
    }
    if (doc.authorId === actor.id) {
      throw new TransitionError('You cannot approve your own document', 403);
    }
    return { newStatus: 'approved', auditAction: 'approved' };
  },

  // submitted → rejected (reviewer/admin, not the owner, comment required)
  'submitted:reject': (doc, actor, comment) => {
    if (actor.role !== 'reviewer' && actor.role !== 'admin') {
      throw new TransitionError('Only reviewers or admins can reject documents', 403);
    }
    if (doc.authorId === actor.id) {
      throw new TransitionError('You cannot reject your own document', 403);
    }
    if (!comment || comment.trim().length === 0) {
      throw new TransitionError('A rejection comment is required', 422);
    }
    return { newStatus: 'rejected', auditAction: 'rejected' };
  },

  // rejected → draft (owner author only)
  'rejected:reopen': (doc, actor) => {
    if (actor.role !== 'author') {
      throw new TransitionError('Only authors can reopen documents', 403);
    }
    if (doc.authorId !== actor.id) {
      throw new TransitionError('Only the document owner can reopen it', 403);
    }
    return { newStatus: 'draft', auditAction: 'reopened' };
  },

  // approved → published (reviewer or admin)
  'approved:publish': (doc, actor) => {
    if (actor.role !== 'reviewer' && actor.role !== 'admin') {
      throw new TransitionError('Only reviewers or admins can publish documents', 403);
    }
    return { newStatus: 'published', auditAction: 'published' };
  },

  // any active state → archived (admin only)
  'draft:archive': (_doc, actor) => {
    if (actor.role !== 'admin') {
      throw new TransitionError('Only admins can archive documents', 403);
    }
    return { newStatus: 'archived', auditAction: 'archived' };
  },
  'submitted:archive': (_doc, actor) => {
    if (actor.role !== 'admin') {
      throw new TransitionError('Only admins can archive documents', 403);
    }
    return { newStatus: 'archived', auditAction: 'archived' };
  },
  'approved:archive': (_doc, actor) => {
    if (actor.role !== 'admin') {
      throw new TransitionError('Only admins can archive documents', 403);
    }
    return { newStatus: 'archived', auditAction: 'archived' };
  },
  'published:archive': (_doc, actor) => {
    if (actor.role !== 'admin') {
      throw new TransitionError('Only admins can archive documents', 403);
    }
    return { newStatus: 'archived', auditAction: 'archived' };
  },
};

// ── The Single Transition Function ─────────────────────────────────────────
//
// This is the ONLY place that determines if a transition is valid.
// No endpoint should ever mutate doc.status directly.
//
// Throws TransitionError on any invalid attempt.
// Returns { newStatus, auditAction } on success.

export function transition(
  doc: Document,
  action: TransitionAction,
  actor: User,
  comment?: string
): TransitionResult {
  // Archived documents reject all further transitions
  if (doc.status === 'archived') {
    throw new TransitionError('Archived documents cannot be modified', 422);
  }

  const key = `${doc.status}:${action}`;
  const validator = TRANSITION_TABLE[key];

  if (!validator) {
    throw new TransitionError(
      `Invalid transition: cannot '${action}' a document in '${doc.status}' state`,
      422
    );
  }

  return validator(doc, actor, comment);
}
