# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Taskr API — a REST API for task management (users, projects, tasks, comments, tags). Node.js · Express 5 · SQLite via `better-sqlite3` · Jest + supertest. CommonJS modules, no build step, no linter configured.

## Never Do This

- **Never put SQL in `src/routes/` or `src/services/`.** Routes call services; services call `src/db/queries/`. Only query modules touch `db`.
- **Never put business logic or validation in route handlers.** Handlers read the request, call one service function, and send the response.
- **Never name files in camelCase or PascalCase.** Every file under `src/` and `tests/` is kebab-case.

## Context Files

Read the relevant file before starting these tasks:

- `.claude/context/api-conventions.md`: any task involving API routes or endpoints.
- `.claude/context/testing-standard.md`: any task involving tests or test coverage.

## Commands

```bash
npm install
npm run db:seed          # create schema + sample data in taskr.db (skips if users exist)
npm run db:reset         # delete taskr.db and re-seed
npm run dev              # node --watch src/index.js, port 3000 (PORT env overrides)
npm start
npm test                 # all Jest suites (tests/*.test.js)
npx jest tests/tasks.test.js                              # single file
npx jest -t "returns only active tasks when filtered"     # single test by name
```

## Architecture

```
src/
  index.js          builds + exports the app; mounts routers; listens only when run directly
  config.js         PORT
  routes/           one Express router per resource, named <resources>Router
  services/         validation, business rules, side effects (email); throw httpError(status, msg)
  db/
    connection.js   the shared better-sqlite3 connection
    schema.js       createSchema(db), the only copy of the DDL (used by seed.js and tests)
    seed.js         sample data for taskr.db
    queries/        thin prepared-statement wrappers per resource
  middleware/       auth, request-logger, error-handler
  utils/            constants (VALID_TASK_STATUSES), validation, http-error
```

- Request flow: `routes/<resource>.js` → `services/<resource>.js` → `db/queries/<resource>.js`. A service may call other resources' query modules (e.g. `services/tasks.js` checks `queries/projects.js`), but routes never call queries.
- Errors: services `throw httpError(status, message)`; handlers pass them to `next(err)`; `middleware/error-handler.js` sends `{ error: message }` with that status (500 by default) and logs only 5xx errors.
- Mount points (`src/index.js`): `/` and `/health` (meta), `/webhooks`, `/users`, `/projects`, `/tasks`, `/tasks/:taskId/comments`, `/tasks/:taskId/tags` (`taskTagsRouter`), `/tags`. Nested routers use `mergeParams: true`.
- `db/connection.js`: WAL, foreign keys on. `NODE_ENV=test` → `:memory:`; otherwise `DB_PATH` or `taskr.db`.
- Task `status` is constrained to `active | completed | archived` in `db/schema.js`, mirrored in `VALID_TASK_STATUSES` in `utils/constants.js`. Change both together.
- `PUT /tasks/:id` sets `completed_at` when status transitions to `completed` and clears it when moving away (`services/tasks.js`).
- `middleware/auth.js` `authenticate` is a stub that checks the `x-api-key` header against `API_KEY` (default `dev-key`). It's only applied to `DELETE /users/:id` and `DELETE /projects/:id`.
- `services/email.js` is a console-logging stub called from `services/users.js` `createUser`.

## Testing

Each test file sets `process.env.NODE_ENV = 'test'` **before** requiring `../src/index` / `../src/db/connection` (required so the in-memory DB is used), calls `createSchema(db)` from `../src/db/schema` in `beforeAll`, and wipes all tables in `beforeEach`. Follow the same pattern in new test files.

Test files are named `tests/<resource>.test.js`, one per resource, and Jest picks them up automatically.
