process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/index');
const { db } = require('../src/db/connection');
const { createSchema } = require('../src/db/schema');

beforeAll(() => {
  createSchema(db);
});

beforeEach(() => {
  db.exec('DELETE FROM task_tags; DELETE FROM comments; DELETE FROM tasks; DELETE FROM projects; DELETE FROM users; DELETE FROM tags;');
  db.prepare('INSERT INTO users (id, name, email) VALUES (1, ?, ?)').run('Commenter', 'commenter@test.com');
  db.prepare('INSERT INTO tasks (id, title) VALUES (1, ?)').run('Discussed Task');
});

function countComments() {
  return db.prepare('SELECT COUNT(*) AS n FROM comments').get().n;
}

describe('GET /tasks/:id/comments', () => {
  test('returns the task\'s comments with the author\'s name, oldest first', async () => {
    db.prepare("INSERT INTO comments (task_id, user_id, body, created_at) VALUES (1, 1, 'Second', '2024-01-02')").run();
    db.prepare("INSERT INTO comments (task_id, user_id, body, created_at) VALUES (1, 1, 'First', '2024-01-01')").run();

    const res = await request(app).get('/tasks/1/comments');
    expect(res.status).toBe(200);
    expect(res.body.map(c => c.body)).toEqual(['First', 'Second']);
    expect(res.body[0].user_name).toBe('Commenter');
  });

  test('returns an empty list for a task with no comments', async () => {
    const res = await request(app).get('/tasks/1/comments');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns not found for an unknown task', async () => {
    const res = await request(app).get('/tasks/99999/comments');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  test('returns not found for a non-numeric task id', async () => {
    const res = await request(app).get('/tasks/abc/comments');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});

describe('POST /tasks/:id/comments', () => {
  test('adds a comment and returns it with the author\'s name', async () => {
    const res = await request(app).post('/tasks/1/comments').send({ user_id: 1, body: 'Looks good' });
    expect(res.status).toBe(201);
    expect(res.body.body).toBe('Looks good');
    expect(res.body.task_id).toBe(1);
    expect(res.body.user_id).toBe(1);
    expect(res.body.user_name).toBe('Commenter');
  });

  test('returns not found for an unknown task', async () => {
    const res = await request(app).post('/tasks/99999/comments').send({ user_id: 1, body: 'Hello?' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(countComments()).toBe(0);
  });

  test('rejects a comment with no body', async () => {
    const res = await request(app).post('/tasks/1/comments').send({ user_id: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(countComments()).toBe(0);
  });

  test('rejects a comment with a blank body', async () => {
    const res = await request(app).post('/tasks/1/comments').send({ user_id: 1, body: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(countComments()).toBe(0);
  });

  test('rejects a comment with no author', async () => {
    const res = await request(app).post('/tasks/1/comments').send({ body: 'Anonymous' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(countComments()).toBe(0);
  });

  test('rejects a comment from a user who does not exist', async () => {
    const res = await request(app).post('/tasks/1/comments').send({ user_id: 999, body: 'Ghost' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(countComments()).toBe(0);
  });
});
