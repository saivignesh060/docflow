# DocFlow

DocFlow is a small controlled document approval system built for the ElevateBox engineering challenge. Documents move through a strict workflow and every state change is recorded in an audit log.

## Stack
- Backend: Node.js, Express, TypeScript, Drizzle ORM
- Database: PostgreSQL via Docker Compose
- Frontend: React, Vite, TypeScript
- Tests: Vitest for the pure transition state machine

## Workflow
Documents move through:

`draft -> submitted -> approved -> published`

Additional states:
- `rejected`: reviewer/admin sends a submitted document back with a required comment.
- `archived`: admin-only terminal state.

All transitions are validated in `backend/src/lib/transition.ts`. API routes must not mutate `status` directly.

## Roles
- `viewer`: can see published documents only.
- `author`: can create documents, edit own draft/rejected documents, submit own drafts, and see own documents at any status plus published documents from others.
- `reviewer`: can review submitted documents, cannot approve/reject their own documents, and cannot see other authors' drafts or archived documents.
- `admin`: can archive documents and is the only role that can view archived documents.

Seeded users:
- `alice@example.com` - author
- `bob@example.com` - reviewer
- `admin@example.com` - admin
- `viewer@example.com` - viewer

## Archived Documents
Archived documents are hidden from the default document list. The `includeArchived=true` query parameter is honored only for admins; non-admin roles cannot list archived documents or fetch them directly by ID/history route.

The frontend shows the "Show archived" checkbox only for admins.

## Getting Started
Start PostgreSQL:

```bash
docker-compose up -d
```

Run migrations and seed data:

```bash
npm run db:migrate --workspace=backend
npm run db:seed --workspace=backend
```

Start the app:

```bash
npm run dev
```

Frontend: `http://localhost:5173`  
Backend API: `http://localhost:3001`

## Useful Scripts
```bash
npm run dev
npm run build --workspace=backend
npm run build --workspace=frontend
npm test --workspace=backend
```

## Key Files
- `backend/src/lib/transition.ts`: state machine and transition validation
- `backend/src/routes/documents.ts`: API routes, visibility checks, transactions, audit log writes
- `backend/src/db/schema.ts`: Drizzle schema and TypeScript model types
- `backend/src/lib/transition.test.ts`: pure transition unit tests
- `frontend/src/App.tsx`: main UI state, user switcher flow, archived toggle visibility
- `DESIGN.md`: design answers from `PRD.md` section 10
