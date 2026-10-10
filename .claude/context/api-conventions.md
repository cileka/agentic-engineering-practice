# API Conventions: Adding a New Endpoint

How to add a new API endpoint to the Taskr API. These conventions describe the target structure after the refactor. Do not add to `routes.js` or copy the patterns in it (inline SQL, inline validation, business logic in handlers).

## 1. Route file: `src/routes/<resources>.js`

- New routes go in a dedicated file in `src/routes/`, one file per resource.
- The file name is the resource name in **lowercase plural**, e.g. `src/routes/tags.js`, `src/routes/comments.js`.
- Each route file exports a **named** Express router, `<resources>Router`:

```js
const express = require('express');
const tagsService = require('../services/tags');

const tagsRouter = express.Router();

// ...handlers

module.exports = { tagsRouter };
```

Paths inside the router are relative to the resource path it is mounted on (`/`, `/:id`), not the full path (`/tags/:id`).

## 2. Handlers call services: `src/services/`

Every route handler calls a corresponding function in `src/services/` and holds no business logic itself. A handler only:

1. reads input from `req.params`, `req.query` and `req.body`
2. calls the service function
3. sends the response status and JSON

Database queries, validation rules, and side effects such as emails belong in the service, never in the handler.

```js
tagsRouter.get('/:id', async (req, res, next) => {
  try {
    const tag = await tagsService.getTagById(Number(req.params.id));
    if (!tag) return next({ status: 404, message: 'Tag not found' });
    res.json(tag);
  } catch (err) {
    next(err);
  }
});

tagsRouter.post('/', async (req, res, next) => {
  try {
    const tag = await tagsService.createTag(req.body);
    res.status(201).json(tag);
  } catch (err) {
    next(err);
  }
});
```

## 3. Errors go to `next()`

Don't send error responses from handlers with `res.status(...).json(...)`. Pass them to Express's `next` function as an object with a status code and message:

```js
next({ status: 400, message: 'name is required' });
```

Services signal expected failures by throwing an error that carries `status` and `message`, which the handler passes on with `next(err)`. The shared error handler sends the response as `{ error: message }` with the given status. A missing status defaults to 500.

## 4. Register the router in `src/index.js`

Register every route file in `src/index.js` with `app.use`, passing the resource path and the imported router:

```js
const { tagsRouter } = require('./routes/tags');

app.use('/tags', tagsRouter);
```

Register routers before the error handler (`app.use(errorHandler)`), which must remain last.

## 5. Tests

Add tests in `tests/<resource>.test.js`, following the setup pattern described in `CLAUDE.md`.

## Checklist

- [ ] `src/routes/<resources>.js` exports a named `<resources>Router`
- [ ] Handlers only call `src/services/` functions and don't contain business logic
- [ ] Errors are passed to `next({ status, message })`
- [ ] Router registered in `src/index.js` with `app.use('/<resources>', <resources>Router)`
- [ ] Nothing added to `routes.js`, and nothing imported from `misc/`
- [ ] Tests added in `tests/<resource>.test.js`
