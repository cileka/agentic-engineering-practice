# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Taskr API — a REST API for task management (users, projects, tasks, comments, tags). Node.js · Express 5 · SQLite via `better-sqlite3` · Jest + supertest. CommonJS modules, no build step, no linter configured.

This codebase has intentional structural problems (misplaced helpers, circular deps, inline SQL in route handlers, missing service/repository layers, duplicated schema, dead code) that will be addressed in a future refactor. Many are flagged by comments and TODOs in the source. Understand the current state as described below, but avoid reinforcing the bad patterns: don't copy them into new code, and don't extend them just because neighbouring code does. Don't fix them unasked either — the refactor is a separate piece of work.

## Never Do This

- **Never add new route logic to `routes.js`.** It is already too large; any new routes belong in a dedicated route file.
- **Never add new utility functions to `utils.js`** without first checking whether they belong in a more specific module.
- **Never import from files in the `misc/` directory.** That code is dead and scheduled for removal.

## Context Files

Read the relevant file before starting these tasks:

- `.claude/context/api-conventions.md`: any task involving API routes or endpoints.
- `.claude/context/testing-standard.md`: any task involving tests or test coverage.

## Commands

```bash
npm install
npm run db:seed          # create schema + sample data in taskr.db (skips if users exist)
npm run db:reset         # delete taskr.db and re-seed
npm run dev              # node --watch, port 3000 (PORT env overrides)
npm start
npm test                 # all Jest suites
npx jest tests/tasks.test.js          # single file
npx jest -t "filters by ?status"      # single test by name
```

Jest's `testMatch` in `package.json` lists test files explicitly: `tests/*.test.js`, `tests/userTest.js`, `tests/test-projects.js`. A new test file that doesn't follow the `*.test.js` pattern won't run unless added there.

## Architecture

- `index.js` builds the Express app and exports it (only calls `listen` when run directly), so tests import the app via supertest. A couple of routes (`/`, `/webhooks/task-update`) live here instead of `routes.js`.
- `routes.js` holds nearly every route in one router. Handlers mostly run SQL inline against `db` with inline validation. The inconsistent exceptions: users delegate to `UserController.js`, and task reads (`GET /tasks`, `GET /tasks/:id`) use `get-tasks.js`.
- `DB.js` opens the single shared `better-sqlite3` connection (WAL, foreign keys on). `NODE_ENV=test` → `:memory:`; otherwise `DB_PATH` or `taskr.db`.
- **Schema is duplicated**: `db/seed.js` (runtime DB) and `tests/schema.js` (tests). Change both when altering tables. Task `status` is constrained to `active | completed | archived`, mirrored in `VALID_TASK_STATUSES` in `misc/constants.js`.
- `PUT /tasks/:id` sets `completed_at` when status transitions to `completed` and clears it when moving away.
- **Circular dependency**: `routes.js` exports `getTasksForProject`, which `projectHelpers.js` requires lazily; `routes.js` in turn lazily requires `projectHelpers`. Keep these requires inside functions or break the cycle deliberately.
- `auth.js` `authenticate` is a stub checking the `x-api-key` header against `API_KEY` (default `dev-key`); only applied to `DELETE /users/:id` and `DELETE /projects/:id`.
- `sendEmail.js` is a console-logging stub called from `UserController.createUser`.
- `misc/oldRoutes.js` and `misc/temp.js` are dead code (not wired in).

## Testing

Each test file sets `process.env.NODE_ENV = 'test'` **before** requiring `../index` / `../DB` (required so the in-memory DB is used), calls `createSchema(db)` in `beforeAll`, and wipes all tables in `beforeEach`. Follow the same pattern in new test files.

New test files must be named `<resource>.test.js` (e.g. `tags.test.js`, `comments.test.js`). The current inconsistent naming in `tests/` (`userTest.js`, `test-projects.js`) is a known problem that will be standardized — don't copy it. Files matching `*.test.js` are picked up by Jest automatically, with no `package.json` change needed.
