import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users, User } from '../db/schema';
import { eq } from 'drizzle-orm';

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Fake session middleware.
 * Reads the `x-user-id` header (a user UUID) and attaches the corresponding
 * user record to req.user. Returns 401 if the header is missing or invalid.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.headers['x-user-id'] as string | undefined;

  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId));

  if (!user) {
    res.status(401).json({ error: 'Unknown user' });
    return;
  }

  req.user = user;
  next();
}
