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
  db.prepare('INSERT INTO users (id, name, email) VALUES (1, ?, ?)').run('Test User', 'test@example.com');
  db.prepare('INSERT INTO projects (id, name) VALUES (1, ?)').run('Test Project');
});

function insertTask(title, fields = {}) {
  const { status = 'active', project_id = null, assignee_id = null } = fields;
  return db.prepare(
    'INSERT INTO tasks (title, status, project_id, assignee_id) VALUES (?, ?, ?, ?)'
  ).run(title, status, project_id, assignee_id).lastInsertRowid;
}

function countTasks() {
  return db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n;
}

describe('GET /tasks', () => {
  test('returns an empty list when there are no tasks', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns every task', async () => {
    insertTask('Task A');
    insertTask('Task B', { status: 'completed' });
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('returns only active tasks when filtered by status', async () => {
    insertTask('Active Task');
    insertTask('Done Task', { status: 'completed' });
    const res = await request(app).get('/tasks?status=active');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Active Task');
  });

  test('returns only completed tasks when filtered by status', async () => {
    insertTask('Active Task');
    insertTask('Done Task', { status: 'completed' });
    const res = await request(app).get('/tasks?status=completed');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Done Task');
  });

  test('returns only tasks in the given project', async () => {
    insertTask('Task in project', { project_id: 1 });
    insertTask('Unassigned task');
    const res = await request(app).get('/tasks?project_id=1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Task in project');
  });

  test('returns only tasks assigned to the given user', async () => {
    insertTask('Mine', { assignee_id: 1 });
    insertTask('Nobody\'s');
    const res = await request(app).get('/tasks?assignee_id=1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Mine');
  });

  test('returns one page of tasks at a time', async () => {
    for (let i = 1; i <= 5; i++) insertTask(`Task ${i}`);
    const page1 = await request(app).get('/tasks?page=1&page_size=2');
    const page3 = await request(app).get('/tasks?page=3&page_size=2');
    expect(page1.status).toBe(200);
    expect(page1.body).toHaveLength(2);
    expect(page3.body).toHaveLength(1);
  });

  test('rejects an unknown status filter', async () => {
    const res = await request(app).get('/tasks?status=invalid');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('rejects a status filter in the wrong case', async () => {
    const res = await request(app).get('/tasks?status=ACTIVE');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

describe('POST /tasks', () => {
  test('creates an active task and returns it', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'New Task', description: 'Do the thing' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('New Task');
    expect(res.body.description).toBe('Do the thing');
    expect(res.body.status).toBe('active');
    expect(res.body.id).toBeDefined();
  });

  test('creates a task in a project with an assignee', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'Project Task', project_id: 1, assignee_id: 1 });
    expect(res.status).toBe(201);
    expect(res.body.project_id).toBe(1);
    expect(res.body.assignee_id).toBe(1);
  });

  test('rejects a task with no title', async () => {
    const res = await request(app).post('/tasks').send({ description: 'No title here' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(countTasks()).toBe(0);
  });

  test('rejects a task with a blank title', async () => {
    const res = await request(app).post('/tasks').send({ title: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(countTasks()).toBe(0);
  });

  test('rejects a task in a project that does not exist', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Orphan', project_id: 999 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(countTasks()).toBe(0);
  });

  test('rejects a task assigned to a user who does not exist', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Orphan', assignee_id: 999 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(countTasks()).toBe(0);
  });
});

describe('GET /tasks/:id', () => {
  test('returns a task with its tags and comments', async () => {
    const taskId = insertTask('Find Me');
    const tagId = db.prepare("INSERT INTO tags (name) VALUES ('urgent')").run().lastInsertRowid;
    db.prepare('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)').run(taskId, tagId);
    db.prepare('INSERT INTO comments (task_id, user_id, body) VALUES (?, 1, ?)').run(taskId, 'On it');

    const res = await request(app).get(`/tasks/${taskId}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Find Me');
    expect(res.body.tags.map(t => t.name)).toEqual(['urgent']);
    expect(res.body.comments).toHaveLength(1);
    expect(res.body.comments[0].body).toBe('On it');
    expect(res.body.comments[0].user_name).toBe('Test User');
  });

  test('returns not found for an unknown task', async () => {
    const res = await request(app).get('/tasks/99999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  test('returns not found for a non-numeric id', async () => {
    const res = await request(app).get('/tasks/abc');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});

describe('PUT /tasks/:id', () => {
  test('records when a task was completed', async () => {
    const taskId = insertTask('Update Me');
    const res = await request(app).put(`/tasks/${taskId}`).send({ status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.completed_at).not.toBeNull();
  });

  test('clears the completion time when a task is reopened', async () => {
    const taskId = insertTask('Reopen Me');
    await request(app).put(`/tasks/${taskId}`).send({ status: 'completed' });
    const res = await request(app).put(`/tasks/${taskId}`).send({ status: 'active' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
    expect(res.body.completed_at).toBeNull();
  });

  test('updates the title and keeps the rest', async () => {
    const taskId = insertTask('Old Title', { project_id: 1 });
    const res = await request(app).put(`/tasks/${taskId}`).send({ title: 'New Title' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New Title');
    expect(res.body.project_id).toBe(1);
  });

  test('returns not found for an unknown task', async () => {
    const res = await request(app).put('/tasks/99999').send({ title: 'Ghost' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  test('rejects an unknown status', async () => {
    const taskId = insertTask('Status Test');
    const res = await request(app).put(`/tasks/${taskId}`).send({ status: 'bogus' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(db.prepare('SELECT status FROM tasks WHERE id = ?').get(taskId).status).toBe('active');
  });
});

describe('DELETE /tasks/:id', () => {
  test('removes the task', async () => {
    const taskId = insertTask('Delete Me');
    const res = await request(app).delete(`/tasks/${taskId}`);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);

    const check = await request(app).get(`/tasks/${taskId}`);
    expect(check.status).toBe(404);
  });

  test('returns not found for an unknown task', async () => {
    const res = await request(app).delete('/tasks/99999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  test('returns not found for a non-numeric id', async () => {
    const res = await request(app).delete('/tasks/abc');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});
