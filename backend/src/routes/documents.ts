import { Router, Request, Response } from 'express';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { db, pool } from '../db';
import { documents, auditLogs, users } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { transition, TransitionAction, TransitionError } from '../lib/transition';
import { drizzle } from 'drizzle-orm/node-postgres';

const router = Router();

// Apply auth to all document routes
router.use(requireAuth);


function canViewDocument(doc: typeof documents.$inferSelect, userId: string, userRole: string): boolean {
  if (doc.authorId === userId) return true;
  if (userRole === 'admin') return true;
  if (userRole === 'reviewer') {
    return doc.status !== 'draft' && doc.status !== 'archived';
  }
  return doc.status === 'published';
}

// ── GET /api/documents ─────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const includeArchived = user.role === 'admin' && req.query.includeArchived === 'true';

  try {
    let docs;

    if (user.role === 'admin') {
      docs = await db.select().from(documents).orderBy(desc(documents.updatedAt));
    } else if (user.role === 'reviewer') {
      const allDocs = await db.select().from(documents).orderBy(desc(documents.updatedAt));
      docs = allDocs.filter(
        (d) =>
          d.status !== 'archived' &&
          (d.authorId === user.id || ['submitted', 'approved', 'published', 'rejected'].includes(d.status))
      );
    } else if (user.role === 'author') {
      // Own docs (all statuses) + published docs from others
      const allDocs = await db.select().from(documents).orderBy(desc(documents.updatedAt));
      docs = allDocs.filter(
        (d) => d.authorId === user.id || d.status === 'published'
      );
    } else {
      // viewer
      docs = await db
        .select()
        .from(documents)
        .where(eq(documents.status, 'published'))
        .orderBy(desc(documents.updatedAt));
    }

    if (user.role === 'admin' && !includeArchived) {
      docs = docs.filter((d) => d.status !== 'archived');
    }

    // Enrich with author info
    const authorIds = [...new Set(docs.map((d) => d.authorId))];
    const authorList = authorIds.length
      ? await db.select().from(users).where(inArray(users.id, authorIds))
      : [];
    const authorMap = Object.fromEntries(authorList.map((u) => [u.id, u]));

    const enriched = docs.map((d) => ({
      ...d,
      author: authorMap[d.authorId] ?? null,
    }));

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/documents/:id ─────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { id } = req.params;

  try {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));

    if (!doc || !canViewDocument(doc, user.id, user.role)) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const [author] = await db.select().from(users).where(eq(users.id, doc.authorId));
    res.json({ ...doc, author });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/documents/:id/history ────────────────────────────────────────

router.get('/:id/history', async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { id } = req.params;

  try {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));

    if (!doc || !canViewDocument(doc, user.id, user.role)) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.documentId, id))
      .orderBy(desc(auditLogs.timestamp));

    // Enrich with actor info
    const actorIds = [...new Set(logs.map((l) => l.actorId))];
    const actorList = actorIds.length
      ? await db.select().from(users).where(inArray(users.id, actorIds))
      : [];
    const actorMap = Object.fromEntries(actorList.map((u) => [u.id, u]));

    const enriched = logs.map((l) => ({ ...l, actor: actorMap[l.actorId] ?? null }));
    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/documents ────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;

  if (user.role !== 'author') {
    res.status(403).json({ error: 'Only authors can create documents' });
    return;
  }

  const { title, body } = req.body;

  if (!title || title.trim().length === 0) {
    res.status(422).json({ error: 'Title is required' });
    return;
  }
  if (!body || body.trim().length === 0) {
    res.status(422).json({ error: 'Body is required' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const txDb = drizzle(client);

    const [doc] = await txDb
      .insert(documents)
      .values({ title: title.trim(), body: body.trim(), authorId: user.id })
      .returning();

    await txDb.insert(auditLogs).values({
      documentId: doc.id,
      actorId: user.id,
      action: 'created',
      fromStatus: null,
      toStatus: null,
    });

    await client.query('COMMIT');
    res.status(201).json(doc);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── PATCH /api/documents/:id ───────────────────────────────────────────────

router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { id } = req.params;
  const { title, body, expectedVersion } = req.body;

  try {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));

    if (!doc || !canViewDocument(doc, user.id, user.role)) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    if (doc.authorId !== user.id) {
      res.status(403).json({ error: 'Only the document owner can edit it' });
      return;
    }

    if (doc.status !== 'draft' && doc.status !== 'rejected') {
      res.status(422).json({ error: 'Documents can only be edited when in draft or rejected state' });
      return;
    }

    if (expectedVersion !== undefined && doc.version !== expectedVersion) {
      res.status(409).json({
        error: 'This document has changed — please refresh and try again',
        currentVersion: doc.version,
      });
      return;
    }

    const updates: Partial<typeof documents.$inferInsert> = {
      updatedAt: new Date(),
      version: doc.version + 1,
    };
    if (title && title.trim().length > 0) updates.title = title.trim();
    if (body && body.trim().length > 0) updates.body = body.trim();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const txDb = drizzle(client);

      const result = await txDb
        .update(documents)
        .set(updates)
        .where(and(eq(documents.id, id), eq(documents.version, doc.version)))
        .returning();

      if (result.length === 0) {
        await client.query('ROLLBACK');
        res.status(409).json({
          error: 'This document has changed — please refresh and try again',
        });
        return;
      }

      await txDb.insert(auditLogs).values({
        documentId: id,
        actorId: user.id,
        action: 'edited',
        fromStatus: null,
        toStatus: null,
      });

      await client.query('COMMIT');
      res.json(result[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Generic transition handler ─────────────────────────────────────────────

async function handleTransition(
  req: Request,
  res: Response,
  action: TransitionAction
): Promise<void> {
  const user = req.user!;
  const { id } = req.params;
  const { expectedVersion, comment } = req.body;

  try {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));

    if (!doc || !canViewDocument(doc, user.id, user.role)) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Optimistic concurrency check
    if (expectedVersion !== undefined && doc.version !== expectedVersion) {
      res.status(409).json({
        error: 'This document has changed — please refresh and try again',
        currentVersion: doc.version,
      });
      return;
    }

    // Validate transition (throws TransitionError if invalid)
    const { newStatus, auditAction } = transition(doc, action, user, comment);

    // Build update payload
    const updatePayload: Partial<typeof documents.$inferInsert> = {
      status: newStatus,
      version: doc.version + 1,
      updatedAt: new Date(),
    };

    // Clear or set rejection comment
    if (action === 'reject') {
      updatePayload.rejectionComment = comment;
    } else if (action === 'reopen') {
      updatePayload.rejectionComment = null;
    }

    // Atomic: update status + write audit log in ONE transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const txDb = drizzle(client);

      const result = await txDb
        .update(documents)
        .set(updatePayload)
        .where(and(eq(documents.id, id), eq(documents.version, doc.version)))
        .returning();

      if (result.length === 0) {
        await client.query('ROLLBACK');
        res.status(409).json({
          error: 'This document has changed — please refresh and try again',
        });
        return;
      }

      await txDb.insert(auditLogs).values({
        documentId: id,
        actorId: user.id,
        action: auditAction,
        fromStatus: doc.status,
        toStatus: newStatus,
        comment: comment ?? null,
      });

      await client.query('COMMIT');
      res.json(result[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err instanceof TransitionError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Transition endpoints ───────────────────────────────────────────────────

router.post('/:id/submit',  (req, res) => handleTransition(req, res, 'submit'));
router.post('/:id/approve', (req, res) => handleTransition(req, res, 'approve'));
router.post('/:id/reject',  (req, res) => handleTransition(req, res, 'reject'));
router.post('/:id/reopen',  (req, res) => handleTransition(req, res, 'reopen'));
router.post('/:id/publish', (req, res) => handleTransition(req, res, 'publish'));
router.post('/:id/archive', (req, res) => handleTransition(req, res, 'archive'));

export default router;
