# DocFlow — Build Progress Tracker

> **Purpose:** This file tracks every task so any AI (or human) can pick up exactly where the last session left off.

---

## 2026-07-22 Frontend Blank Screen Fix
- Read all project-authored markdown before making code changes: `README.md`, `PRD.md`, `PROGRESS.md`, and `frontend/README.md`.
- Confirmed runtime issue on `localhost:5173`: frontend was importing TypeScript-only interfaces (`User`, `Document`, `AuditLog`, `DocumentStatus`) as browser runtime exports from `frontend/src/api/client.ts`.
- Updated frontend imports to use `import type` for type-only symbols in `App.tsx`, `UserSwitcher.tsx`, `DocumentDetail.tsx`, `DocumentForm.tsx`, `DocumentHistory.tsx`, and `DocumentList.tsx`.
- Removed a redundant `doc.status !== 'archived'` check in `DocumentDetail` after TypeScript had already narrowed editable statuses to `draft | rejected`.
- Verified `npm run build --workspace=frontend` passes.
- Verified backend API is reachable with `GET http://localhost:3001/api/users` returning `200`.
- Verified Vite's live transform for `App.tsx` now imports only runtime `api` from `/src/api/client.ts`.
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
- [x] Root `package.json` with npm workspaces
- [x] `docker-compose.yml` for PostgreSQL
- [x] `backend/` — Node + Express + TypeScript scaffolding
- [x] `backend/src/db/schema.ts` — Users, Documents, AuditLog tables
- [x] `backend/drizzle.config.ts`
- [x] `backend/src/db/seed.ts` — 4 seeded users
- [x] `backend/src/middleware/auth.ts` — Fake session via `x-user-id` header
- [x] `backend/src/index.ts` — Express app entry

## Phase 2 — Core State Machine
- [x] `backend/src/lib/transition.ts` — `transition(doc, action, user)` function
  - [x] Full transition table encoded
  - [x] Role + ownership validation
  - [x] Comment required for reject
  - [x] Returns `{ newStatus, auditAction }` or throws

## Phase 3 — API Endpoints
- [x] `GET /api/documents` — role-scoped list
- [x] `GET /api/documents/:id` — visibility check
- [x] `GET /api/documents/:id/history` — audit log
- [x] `POST /api/documents` — create draft
- [x] `PATCH /api/documents/:id` — edit (draft/rejected only)
- [x] `POST /api/documents/:id/submit`
- [x] `POST /api/documents/:id/approve`
- [x] `POST /api/documents/:id/reject`
- [x] `POST /api/documents/:id/reopen`
- [x] `POST /api/documents/:id/publish`
- [x] `POST /api/documents/:id/archive`
- [x] `expectedVersion` → 409 conflict on all mutating endpoints

## Phase 4 — Frontend
- [x] Vite + React + TypeScript in `frontend/`
- [x] API client (`frontend/src/api/`)
- [x] `UserSwitcher` component (sidebar — login-as)
- [x] `DocumentList` page (role-scoped)
- [x] `DocumentDetail` page (title, body, status badge, action buttons)
- [x] Action buttons (only valid transitions per role/state shown)
- [x] `DocumentHistory` panel (audit log, tabbed view)
- [x] Create document form
- [x] Edit document form (draft/rejected only)

## Phase 5 — Polish & Verification
- [ ] Start docker-compose + run migrations + seed + verify all endpoints work
- [ ] All 9 invariants from PRD §6 verified manually
- [ ] `DESIGN.md` written (answers PRD §10 questions)
- [ ] Final commit + push to GitHub

---

## Non-Negotiable Invariants Status
| Invariant | Status |
|---|---|
| Every action checked server-side | ✅ Done (middleware + route guards) |
| All transitions via `transition()` | ✅ Done (single function, all endpoints call it) |
| Viewers can't fetch non-published docs | ✅ Done (`canViewDocument()` on all GET routes) |
| Author can't approve/reject/publish own doc | ✅ Done (transition table checks `authorId === actor.id`) |
| Reject requires non-empty comment | ✅ Done (transition table validates) |
| Publish only from `approved` | ✅ Done (only `approved:publish` key in table) |
| Archived docs reject all changes | ✅ Done (early return in `transition()`) |
| Status + AuditLog in one DB transaction | ✅ Done (pg client transactions in all mutating handlers) |
| `expectedVersion` mismatch → 409 | ✅ Done (WHERE version = $version, 0 rows = 409) |

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
