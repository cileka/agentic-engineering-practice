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
});

function countUsers() {
  return db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
}

describe('GET /users', () => {
  test('returns an empty list when there are no users', async () => {
    const res = await request(app).get('/users');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns every user', async () => {
    await request(app).post('/users').send({ name: 'User One', email: 'one@test.com' });
    await request(app).post('/users').send({ name: 'User Two', email: 'two@test.com' });
    const res = await request(app).get('/users');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map(u => u.email).sort()).toEqual(['one@test.com', 'two@test.com']);
  });
});

describe('POST /users', () => {
  test('creates a user and returns it', async () => {
    const res = await request(app)
      .post('/users')
      .send({ name: 'Alice Chen', email: 'alice@test.com' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Alice Chen');
    expect(res.body.email).toBe('alice@test.com');
    expect(res.body.id).toBeDefined();
  });

  test('rejects a user with no name', async () => {
    const res = await request(app).post('/users').send({ email: 'noname@test.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(countUsers()).toBe(0);
  });

  test('rejects a user with no email', async () => {
    const res = await request(app).post('/users').send({ name: 'No Email' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(countUsers()).toBe(0);
  });

  test('rejects an invalid email address', async () => {
    const res = await request(app).post('/users').send({ name: 'Bad Email', email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(countUsers()).toBe(0);
  });

  test('rejects an email that is already registered', async () => {
    await request(app).post('/users').send({ name: 'Alice', email: 'dup@test.com' });
    const res = await request(app).post('/users').send({ name: 'Alice Again', email: 'dup@test.com' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBeDefined();
    expect(countUsers()).toBe(1);
  });
});

describe('GET /users/:id', () => {
  test('returns the user', async () => {
    const created = await request(app).post('/users').send({ name: 'Bob', email: 'bob@test.com' });
    const res = await request(app).get(`/users/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Bob');
    expect(res.body.email).toBe('bob@test.com');
  });

  test('returns not found for an unknown user', async () => {
    const res = await request(app).get('/users/99999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  test('returns not found for a non-numeric id', async () => {
    const res = await request(app).get('/users/abc');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});

describe('PUT /users/:id', () => {
  test('updates the name and keeps the email', async () => {
    const created = await request(app).post('/users').send({ name: 'Old Name', email: 'update@test.com' });
    const res = await request(app).put(`/users/${created.body.id}`).send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
    expect(res.body.email).toBe('update@test.com');
  });

  test('returns not found for an unknown user', async () => {
    const res = await request(app).put('/users/99999').send({ name: 'Ghost' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  test('returns not found for a non-numeric id', async () => {
    const res = await request(app).put('/users/abc').send({ name: 'Ghost' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});

describe('DELETE /users/:id', () => {
  test('removes the user', async () => {
    const created = await request(app).post('/users').send({ name: 'Delete Me', email: 'deleteme@test.com' });
    const userId = created.body.id;

    const res = await request(app).delete(`/users/${userId}`).set('x-api-key', 'dev-key');
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);

    const check = await request(app).get(`/users/${userId}`);
    expect(check.status).toBe(404);
  });

  test('refuses to delete without an API key', async () => {
    const created = await request(app).post('/users').send({ name: 'Keep Me', email: 'keep@test.com' });
    const res = await request(app).delete(`/users/${created.body.id}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(countUsers()).toBe(1);
  });

  test('refuses to delete with the wrong API key', async () => {
    const created = await request(app).post('/users').send({ name: 'Keep Me', email: 'keep@test.com' });
    const res = await request(app).delete(`/users/${created.body.id}`).set('x-api-key', 'wrong');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(countUsers()).toBe(1);
  });

  test('returns not found for an unknown user', async () => {
    const res = await request(app).delete('/users/99999').set('x-api-key', 'dev-key');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});
