process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../index');
const { db } = require('../DB');
const { createSchema } = require('./schema');

beforeAll(() => {
  createSchema(db);
});

beforeEach(() => {
  db.exec('DELETE FROM task_tags; DELETE FROM comments; DELETE FROM tasks; DELETE FROM projects; DELETE FROM users; DELETE FROM tags;');
  db.prepare('INSERT INTO tasks (id, title) VALUES (1, ?)').run('Tagged Task');
  db.prepare("INSERT INTO tags (id, name) VALUES (1, 'urgent')").run();
});

function countTags() {
  return db.prepare('SELECT COUNT(*) AS n FROM tags').get().n;
}

function countTaskTags() {
  return db.prepare('SELECT COUNT(*) AS n FROM task_tags').get().n;
}

describe('GET /tags', () => {
  test('returns every tag in alphabetical order', async () => {
    db.prepare("INSERT INTO tags (name) VALUES ('backend')").run();
    const res = await request(app).get('/tags');
    expect(res.status).toBe(200);
    expect(res.body.map(t => t.name)).toEqual(['backend', 'urgent']);
  });

  test('returns an empty list when there are no tags', async () => {
    db.exec('DELETE FROM tags');
    const res = await request(app).get('/tags');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /tags', () => {
  test('creates a tag with a lowercased, trimmed name', async () => {
    const res = await request(app).post('/tags').send({ name: '  Frontend ' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('frontend');
    expect(res.body.id).toBeDefined();
  });

  test('rejects a tag with no name', async () => {
    const res = await request(app).post('/tags').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(countTags()).toBe(1);
  });

  test('rejects a tag with a blank name', async () => {
    const res = await request(app).post('/tags').send({ name: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(countTags()).toBe(1);
  });

  test('rejects a tag name that already exists, ignoring case', async () => {
    const res = await request(app).post('/tags').send({ name: 'URGENT' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBeDefined();
    expect(countTags()).toBe(1);
  });
});

describe('POST /tasks/:id/tags', () => {
  test('applies a tag to a task', async () => {
    const res = await request(app).post('/tasks/1/tags').send({ tag_id: 1 });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ task_id: 1, tag_id: 1 });

    const task = await request(app).get('/tasks/1');
    expect(task.body.tags.map(t => t.name)).toEqual(['urgent']);
  });

  test('returns not found for an unknown task', async () => {
    const res = await request(app).post('/tasks/99999/tags').send({ tag_id: 1 });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(countTaskTags()).toBe(0);
  });

  test('rejects a request with no tag', async () => {
    const res = await request(app).post('/tasks/1/tags').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(countTaskTags()).toBe(0);
  });

  test('returns not found for an unknown tag', async () => {
    const res = await request(app).post('/tasks/1/tags').send({ tag_id: 999 });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(countTaskTags()).toBe(0);
  });

  test('rejects a tag that is already applied to the task', async () => {
    await request(app).post('/tasks/1/tags').send({ tag_id: 1 });
    const res = await request(app).post('/tasks/1/tags').send({ tag_id: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBeDefined();
    expect(countTaskTags()).toBe(1);
  });
});

describe('DELETE /tasks/:id/tags/:tagId', () => {
  test('removes a tag from a task', async () => {
    db.prepare('INSERT INTO task_tags (task_id, tag_id) VALUES (1, 1)').run();
    const res = await request(app).delete('/tasks/1/tags/1');
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
    expect(countTaskTags()).toBe(0);
  });

  test('returns not found when the tag is not applied to the task', async () => {
    const res = await request(app).delete('/tasks/1/tags/1');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  test('returns not found for an unknown task', async () => {
    const res = await request(app).delete('/tasks/99999/tags/1');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});
