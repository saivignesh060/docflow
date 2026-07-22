import { describe, expect, it } from 'vitest';
import type { Document, DocumentStatus, User } from '../db/schema';
import { transition, type TransitionAction, TransitionError } from './transition';

const authorId = '11111111-1111-1111-1111-111111111111';
const reviewerId = '22222222-2222-2222-2222-222222222222';
const adminId = '33333333-3333-3333-3333-333333333333';

function makeDoc(status: DocumentStatus, overrides: Partial<Document> = {}): Document {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    title: 'Policy',
    body: 'Policy body',
    status,
    authorId,
    version: 1,
    rejectionComment: null,
    createdAt: new Date('2026-07-22T00:00:00.000Z'),
    updatedAt: new Date('2026-07-22T00:00:00.000Z'),
    ...overrides,
  };
}

function makeUser(role: User['role'], id: string): User {
  return {
    id,
    email: `${role}@example.com`,
    name: role,
    role,
  };
}

const author = makeUser('author', authorId);
const reviewer = makeUser('reviewer', reviewerId);
const admin = makeUser('admin', adminId);

function expectTransitionError(fn: () => unknown, statusCode = 422) {
  expect(fn).toThrow(TransitionError);
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(TransitionError);
    expect((err as TransitionError).statusCode).toBe(statusCode);
  }
}

describe('transition', () => {
  it('draft:submit succeeds for the owner and throws for a non-owner', () => {
    expect(transition(makeDoc('draft'), 'submit', author)).toEqual({
      newStatus: 'submitted',
      auditAction: 'submitted',
    });

    expectTransitionError(() => transition(makeDoc('draft'), 'submit', reviewer), 403);
  });

  it('submitted:approve throws for self-approval', () => {
    expectTransitionError(
      () => transition(makeDoc('submitted'), 'approve', makeUser('reviewer', authorId)),
      403
    );
  });

  it('submitted:reject throws if comment is missing or empty', () => {
    expectTransitionError(() => transition(makeDoc('submitted'), 'reject', reviewer), 422);
    expectTransitionError(() => transition(makeDoc('submitted'), 'reject', reviewer, '   '), 422);
  });

  it('submitted:reject succeeds with a comment', () => {
    expect(transition(makeDoc('submitted'), 'reject', reviewer, 'Needs changes')).toEqual({
      newStatus: 'rejected',
      auditAction: 'rejected',
    });
  });

  it('approved:publish succeeds for reviewer and admin', () => {
    expect(transition(makeDoc('approved'), 'publish', reviewer)).toEqual({
      newStatus: 'published',
      auditAction: 'published',
    });
    expect(transition(makeDoc('approved'), 'publish', admin)).toEqual({
      newStatus: 'published',
      auditAction: 'published',
    });
  });

  it('throws for any action on an archived document', () => {
    const actions: TransitionAction[] = ['submit', 'approve', 'reject', 'reopen', 'publish', 'archive'];

    for (const action of actions) {
      expectTransitionError(() => transition(makeDoc('archived'), action, admin, 'comment'), 422);
    }
  });

  it('throws with 422 for invalid transition pairs', () => {
    expectTransitionError(() => transition(makeDoc('draft'), 'approve', reviewer), 422);
    expectTransitionError(() => transition(makeDoc('published'), 'submit', author), 422);
  });
});
