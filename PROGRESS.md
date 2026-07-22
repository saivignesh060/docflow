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

---

## 2026-07-22 Author-Owned Archives and Author-Only Creation
- Restricted document creation to authors only in `backend/src/routes/documents.ts`; admin create attempts now return `403`.
- Updated `backend/src/lib/transition.ts` so `draft:submit` and `rejected:reopen` require `actor.role === 'author'`, while preserving the owner check.
- Updated frontend creation/action UI: `frontend/src/components/DocumentList.tsx` shows `+ New` only for authors, and `frontend/src/components/DocumentDetail.tsx` shows owner submit/reopen only for authors while keeping admin archive actions.
- Corrected archived ownership visibility: `canViewDocument()` now allows document owners to see their own documents at any status, including `archived`.
- Updated the author list rule so authors see their own archived documents plus published documents from others.
- Updated `README.md` and `DESIGN.md` to match owner-visible archived documents and author-only creation.
- Verified `npm test --workspace=backend` passes: 7 tests passed.
- Verified `npm run build --workspace=backend` passes.
- Verified `npm run build --workspace=frontend` passes.
- Manually verified: admin document creation returned `403`; Alice could see her archived document in list/detail/history; Bob/reviewer and viewer could not list, fetch, or fetch history for that same archived document.

---

## 2026-07-22 Archived Visibility Hardening
- Tightened `backend/src/routes/documents.ts` so `includeArchived=true` is honored only for admins.
- Updated `canViewDocument()` so archived documents return `404` for all non-admin roles on direct `GET /api/documents/:id` and `GET /api/documents/:id/history`.
- Kept viewer list access locked to `published` documents only, regardless of query params.
- Kept author list access to own non-archived documents plus published documents from others; archived documents no longer appear even for the owner.
- Kept reviewer list access to own non-archived documents plus submitted, approved, published, and rejected documents; archived documents no longer appear even when `includeArchived=true` is sent manually.
- Updated `frontend/src/App.tsx` so the "Show archived" checkbox renders only for admins and the frontend sends `includeArchived=true` only for admins with the checkbox enabled.
- Verified `npm test --workspace=backend` passes: 7 tests passed.
- Verified `npm run build --workspace=backend` passes.
- Verified `npm run build --workspace=frontend` passes.
- Manually verified an Alice-owned archived document: viewer, author, and reviewer could not list it with `includeArchived=true`, and direct detail/history requests returned `404`; admin default list excluded it, while admin `includeArchived=true` included it.

---

## 2026-07-22 Reviewer Visibility, Archives, Tests, and Design Notes
- Fixed reviewer document visibility in `backend/src/routes/documents.ts`: reviewers can see all non-draft documents plus their own drafts, but not drafts owned by other authors.
- Split `GET /api/documents` list behavior so admins still see everything, while reviewers filter out other authors' drafts.
- Added `includeArchived=true` support to `GET /api/documents`; archived documents are excluded by default for non-admin roles, while admins continue seeing archived documents.
- Added a single frontend "Show archived" checkbox in the sidebar and threaded it through `frontend/src/api/client.ts` and `frontend/src/App.tsx`.
- Removed dead code from `backend/src/routes/documents.ts`: the unused `visibleStatuses()` helper and the unreachable archived edit check in `PATCH /:id`.
- Added pure unit coverage for `backend/src/lib/transition.ts` in `backend/src/lib/transition.test.ts`, using Vitest.
- Added `DESIGN.md` at the repo root answering the 8 questions from `PRD.md` section 10 with references to real code files/functions.
- Updated backend test/build configuration with a `test` script, Vitest dev dependency, and `tsconfig.json` exclusion for `src/**/*.test.ts`.
- Verified `npm test --workspace=backend` passes: 7 tests passed.
- Verified `npm run build --workspace=backend` passes.
- Verified `npm run build --workspace=frontend` passes.
- Manually re-tested reviewer access against an Alice-owned draft as Bob/reviewer; `GET /api/documents/:id` returned `404`.

- `backend/src/lib/transition.ts` — The core state machine (most important file)
- `backend/src/routes/documents.ts` — All API routes
- `backend/src/db/schema.ts` — DB schema
- `frontend/src/App.tsx` — Frontend entry
