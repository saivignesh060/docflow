# DocFlow Design Notes

## What are the most important invariants in this system?
The most important invariant is that document status can only change through the workflow encoded in `backend/src/lib/transition.ts`'s `TRANSITION_TABLE`. A close second is auditability: every create, edit, and transition route in `backend/src/routes/documents.ts` writes an `auditLogs` row along with the document change. Read visibility is also an invariant: `canViewDocument()` keeps drafts and archived documents from leaking to roles that should not see them.

## Which are enforced by Postgres/schema constraints vs. application code?
`backend/src/db/schema.ts` enforces required columns, enums for `role`, `document_status`, and `audit_action`, foreign keys from documents to users, and the `version` column default. Workflow rules, ownership checks, role permissions, rejection comments, and visibility rules are enforced in application code, mainly `transition.ts`, `canViewDocument()`, and the route handlers in `backend/src/routes/documents.ts`.

## How do permissions work?
Requests are authenticated by `backend/src/middleware/auth.ts`, which reads `x-user-id` and attaches the seeded user to `req.user`. Read access is checked by `canViewDocument()` in `backend/src/routes/documents.ts`; viewers only see published documents, reviewers do not see other authors' drafts, and archived documents are visible only to admins. Mutation permissions are checked both in route guards and in `transition.ts`'s validators for actions like `submit`, `approve`, `reject`, `publish`, and `archive`.

## How are stale/conflicting updates prevented?
Documents have a `version` column in `backend/src/db/schema.ts`, and mutating routes accept `expectedVersion`. `backend/src/routes/documents.ts` compares the submitted version before writing and also performs updates with `WHERE id = ... AND version = ...`, returning `409` when no row is updated.

## How is audit-log consistency guaranteed?
Create, edit, and transition handlers in `backend/src/routes/documents.ts` open a Postgres transaction with `pool.connect()`, `BEGIN`, and a transaction-scoped Drizzle instance. The document update and `auditLogs` insert are committed together with `COMMIT`, and failures call `ROLLBACK`, so the audit row and state change do not diverge.

## What failure cases were considered?
`transition.ts` rejects invalid state/action pairs, self-approval and self-rejection, missing rejection comments, unauthorized roles, and any action against an archived document. `backend/src/routes/documents.ts` also handles missing or hidden documents as `404`, including archived documents requested by non-admin users through detail or history routes. It handles unauthorized edits as `403`, invalid edit states as `422`, stale versions as `409`, and server failures as `500`.

## What would be improved with more time?
The backend currently has pure unit tests for `transition.ts` in `backend/src/lib/transition.test.ts`, but `backend/src/routes/documents.ts` would benefit from integration tests around role-scoped list visibility, admin-only `includeArchived`, direct archived document access, and transaction behavior. The frontend in `frontend/src/App.tsx` is intentionally simple, so a larger build could add stronger loading/error states and automated UI tests without changing the core workflow.

## What would need to change for real production use?
`backend/src/middleware/auth.ts` uses a fake `x-user-id` session, so production would need real authentication, authorization hardening, and request auditing. The API would also need stricter validation middleware, migration management beyond the local scripts in `backend/src/db`, production logging, deployment configuration, and a tested backup/restore plan for Postgres.
