# DocFlow — Build Progress Tracker

> **Purpose:** This file tracks every task so any AI (or human) can pick up exactly where the last session left off.
> **Last updated:** Phase 1 — Backend Foundation started

---

## Assumptions Made
- PostgreSQL via `docker-compose.yml` (run: `docker-compose up -d`)
- npm workspaces monorepo (one root `package.json`)
- Frontend: Clean dark-mode UI (polished but not pixel-perfect)
- Backend port: `3001` | Frontend port: `5173`
- TypeScript throughout (backend + frontend)

---

## Phase 1 — Backend Foundation
- [ ] Root `package.json` with npm workspaces
- [ ] `docker-compose.yml` for PostgreSQL
- [ ] `backend/` — Node + Express + TypeScript scaffolding
- [ ] `backend/src/db/schema.ts` — Users, Documents, AuditLog tables
- [ ] `backend/drizzle.config.ts`
- [ ] `backend/src/db/seed.ts` — 4 seeded users
- [ ] `backend/src/middleware/auth.ts` — Fake session via `x-user-id` header
- [ ] `backend/src/index.ts` — Express app entry

## Phase 2 — Core State Machine
- [ ] `backend/src/lib/transition.ts` — `transition(doc, action, user)` function
  - [ ] Full transition table encoded
  - [ ] Role + ownership validation
  - [ ] Comment required for reject
  - [ ] Returns `{ newStatus, auditAction }` or throws

## Phase 3 — API Endpoints
- [ ] `GET /api/documents` — role-scoped list
- [ ] `GET /api/documents/:id` — visibility check
- [ ] `GET /api/documents/:id/history` — audit log
- [ ] `POST /api/documents` — create draft
- [ ] `PATCH /api/documents/:id` — edit (draft/rejected only)
- [ ] `POST /api/documents/:id/submit`
- [ ] `POST /api/documents/:id/approve`
- [ ] `POST /api/documents/:id/reject`
- [ ] `POST /api/documents/:id/reopen`
- [ ] `POST /api/documents/:id/publish`
- [ ] `POST /api/documents/:id/archive`
- [ ] `expectedVersion` → 409 conflict on all mutating endpoints

## Phase 4 — Frontend
- [ ] Vite + React + TypeScript in `frontend/`
- [ ] API client (`frontend/src/api/`)
- [ ] `UserSwitcher` component (top bar — login-as)
- [ ] `DocumentList` page (role-scoped)
- [ ] `DocumentDetail` page (title, body, status badge, action buttons)
- [ ] Action buttons (only valid transitions per role/state shown)
- [ ] `DocumentHistory` panel (audit log)
- [ ] Create document form
- [ ] Edit document form (draft/rejected only)

## Phase 5 — Polish & Verification
- [ ] All 9 invariants from PRD §6 verified manually
- [ ] `DESIGN.md` written (answers PRD §10 questions)
- [ ] Final commit + push to GitHub

---

## Non-Negotiable Invariants Status
| Invariant | Status |
|---|---|
| Every action checked server-side | ⏳ Pending |
| All transitions via `transition()` | ⏳ Pending |
| Viewers can't fetch non-published docs | ⏳ Pending |
| Author can't approve/reject/publish own doc | ⏳ Pending |
| Reject requires non-empty comment | ⏳ Pending |
| Publish only from `approved` | ⏳ Pending |
| Archived docs reject all changes | ⏳ Pending |
| Status + AuditLog in one DB transaction | ⏳ Pending |
| `expectedVersion` mismatch → 409 | ⏳ Pending |

---

## How to Resume (for next AI session)
1. Read `PRD.md` for requirements
2. Read this file to know current status
3. Check the [ ] items above — start from the first incomplete task
4. Run `docker-compose up -d` to start Postgres
5. `cd backend && npm run db:migrate && npm run db:seed` to init DB
6. `npm run dev` from root to start both servers

## Key Files
- `backend/src/lib/transition.ts` — The core state machine (most important file)
- `backend/src/routes/documents.ts` — All API routes
- `backend/src/db/schema.ts` — DB schema
- `frontend/src/App.tsx` — Frontend entry
