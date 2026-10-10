# Testing Standard

How to write tests for the Taskr API.

## 1. File naming: `tests/<resource>.test.js`

- One test file per resource, named `<resource>.test.js` in **lowercase**, e.g. `tests/tags.test.js`, `tests/comments.test.js`.
- Don't copy the existing inconsistent names (`userTest.js`, `test-projects.js`). They are a known problem that will be standardized.
- Jest picks up `*.test.js` files automatically, so a new file needs no `package.json` change.

## 2. Jest + supertest against in-memory SQLite

Tests use Jest and supertest against an in-memory SQLite database, so no external setup is required. Every test file starts with this setup:

```js
process.env.NODE_ENV = 'test'; // must come first: makes DB.js use ':memory:'

const request = require('supertest');
const app = require('../index');
const { db } = require('../DB');
const { createSchema } = require('./schema');

beforeAll(() => {
  createSchema(db);
});

beforeEach(() => {
  db.exec('DELETE FROM task_tags; DELETE FROM comments; DELETE FROM tasks; DELETE FROM projects; DELETE FROM users; DELETE FROM tags;');
  // insert only the rows this file's tests need, e.g.:
  db.prepare('INSERT INTO users (id, name, email) VALUES (1, ?, ?)').run('Test User', 'test@example.com');
});
```

- Set `NODE_ENV` **before** requiring `../index` or `../DB`, or the tests will hit the real `taskr.db` file.
- Create the schema with `tests/schema.js`. Don't rely on `taskr.db`, `npm run db:seed`, or seed data.
- Send requests through `request(app)`. Never start a server with `app.listen`.
- Each test builds its own data with `db.prepare(...)` or API calls, and must not depend on another test having run first.

## 3. Coverage: happy path + at least two error cases per endpoint

For every endpoint, write:

- **One happy-path test** that checks the status code and the relevant fields of the response body, not just the status.
- **At least two error-case tests**, choosing from the failures that endpoint can actually produce:
  - `400`: missing or empty required field, invalid value (e.g. unknown task status), or a referenced record that doesn't exist
  - `401`: missing or wrong `x-api-key` on protected routes
  - `404`: unknown id in the path
  - `409`: duplicate of a unique value (user email, tag name, a tag already applied to a task)

For error cases, check the status code and that `res.body.error` is defined. If a write should have been rejected, also check it didn't change the database.

Group tests by endpoint with one `describe` block each, named by method and path:

```js
describe('POST /tags', () => {
  test('creates a new tag and returns it', async () => { /* ... */ });
  test('rejects a tag with no name', async () => { /* ... */ });
  test('rejects a tag name that already exists', async () => { /* ... */ });
});
```

## 4. Plain-English test descriptions

Test descriptions say what the endpoint does, in plain English, from the API user's point of view. Don't describe implementation details.

| Do | Don't |
|---|---|
| `returns only active tasks when filtered by status` | `adds WHERE status = ? to the query` |
| `rejects a task with no title` | `returns 400 when isNonEmptyString fails` |
| `records when a task was completed` | `sets completed_at via new Date().toISOString()` |
| `returns a task with its tags and comments` | `joins task_tags and comments tables` |

## 5. Runs with `npm test` and no other setup

The full suite must pass after `npm install` and `npm test` alone, with no database file, seeding, environment variables, running server, or network access. Run a single file with `npx jest tests/<resource>.test.js` while developing, then run `npm test` before finishing.

## Checklist

- [ ] File named `tests/<resource>.test.js` in lowercase
- [ ] `NODE_ENV = 'test'` set before any app or DB require, schema created in `beforeAll`, tables cleared in `beforeEach`
- [ ] Every endpoint has a happy-path test and at least two error cases
- [ ] Descriptions are plain English about behaviour, not implementation
- [ ] `npm test` passes with no other setup
