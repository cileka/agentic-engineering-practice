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
  db.prepare('INSERT INTO users (id, name, email) VALUES (1, ?, ?)').run('Project Owner', 'owner@test.com');
});

function countProjects() {
  return db.prepare('SELECT COUNT(*) AS n FROM projects').get().n;
}

function insertProject(name) {
  return db.prepare('INSERT INTO projects (name) VALUES (?)').run(name).lastInsertRowid;
}

describe('GET /projects', () => {
  test('returns an empty list when there are no projects', async () => {
    const res = await request(app).get('/projects');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns every project', async () => {
    insertProject('Alpha');
    insertProject('Beta');
    const res = await request(app).get('/projects');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map(p => p.name).sort()).toEqual(['Alpha', 'Beta']);
  });
});

describe('POST /projects', () => {
  test('creates a project and returns it', async () => {
    const res = await request(app)
      .post('/projects')
      .send({ name: 'My Project', description: 'A test project', owner_id: 1 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('My Project');
    expect(res.body.description).toBe('A test project');
    expect(res.body.owner_id).toBe(1);
    expect(res.body.id).toBeDefined();
  });

  test('rejects a project with no name', async () => {
    const res = await request(app).post('/projects').send({ description: 'No name' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(countProjects()).toBe(0);
  });

  test('rejects a project with a blank name', async () => {
    const res = await request(app).post('/projects').send({ name: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(countProjects()).toBe(0);
  });
});

describe('GET /projects/:id', () => {
  test('returns the project with task counts by status', async () => {
    const projectId = insertProject('Stats Project');
    await request(app).post('/tasks').send({ title: 'Active task', project_id: projectId });
    await request(app).post('/tasks').send({ title: 'Another active', project_id: projectId });

    const res = await request(app).get(`/projects/${projectId}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Stats Project');
    expect(res.body.stats).toEqual({ total: 2, active: 2, completed: 0, archived: 0 });
  });

  test('returns not found for an unknown project', async () => {
    const res = await request(app).get('/projects/99999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  test('returns not found for a non-numeric id', async () => {
    const res = await request(app).get('/projects/abc');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});

describe('PUT /projects/:id', () => {
  test('updates the given fields and keeps the rest', async () => {
    const created = await request(app).post('/projects').send({ name: 'Old Name', owner_id: 1 });
    const res = await request(app)
      .put(`/projects/${created.body.id}`)
      .send({ name: 'New Name', description: 'Updated desc' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
    expect(res.body.description).toBe('Updated desc');
    expect(res.body.owner_id).toBe(1);
  });

  test('returns not found for an unknown project', async () => {
    const res = await request(app).put('/projects/99999').send({ name: 'Ghost' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  test('returns not found for a non-numeric id', async () => {
    const res = await request(app).put('/projects/abc').send({ name: 'Ghost' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});

describe('DELETE /projects/:id', () => {
  test('removes the project', async () => {
    const projectId = insertProject('Doomed Project');
    const res = await request(app).delete(`/projects/${projectId}`).set('x-api-key', 'dev-key');
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);

    const check = await request(app).get(`/projects/${projectId}`);
    expect(check.status).toBe(404);
  });

  test('refuses to delete without an API key', async () => {
    const projectId = insertProject('Keep Me');
    const res = await request(app).delete(`/projects/${projectId}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(countProjects()).toBe(1);
  });

  test('returns not found for an unknown project', async () => {
    const res = await request(app).delete('/projects/99999').set('x-api-key', 'dev-key');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});
