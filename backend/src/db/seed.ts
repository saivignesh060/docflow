import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { users } from './schema';

dotenv.config();

const SEEDED_USERS = [
  { email: 'alice@example.com', name: 'Alice', role: 'author' as const },
  { email: 'bob@example.com', name: 'Bob', role: 'reviewer' as const },
  { email: 'admin@example.com', name: 'Admin', role: 'admin' as const },
  { email: 'viewer@example.com', name: 'Viewer', role: 'viewer' as const },
];

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://docflow:docflow@localhost:5432/docflow',
  });
  const db = drizzle(pool);

  console.log('Seeding users...');
  for (const user of SEEDED_USERS) {
    await db
      .insert(users)
      .values(user)
      .onConflictDoUpdate({
        target: users.email,
        set: { name: user.name, role: user.role },
      });
    console.log(`  ✓ ${user.email} (${user.role})`);
  }

  console.log('Seeding complete.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
