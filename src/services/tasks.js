const tasksQueries = require('../db/queries/tasks');
const projectsQueries = require('../db/queries/projects');
const usersQueries = require('../db/queries/users');
const commentsQueries = require('../db/queries/comments');
const tagsQueries = require('../db/queries/tags');
const { isNonEmptyString } = require('../utils/validation');
const { httpError } = require('../utils/http-error');
const { VALID_TASK_STATUSES } = require('../utils/constants');

function assertValidStatus(status) {
  if (status && !VALID_TASK_STATUSES.includes(status)) {
    throw httpError(400, `status must be one of: ${VALID_TASK_STATUSES.join(', ')}`);
  }
}

function listTasks({ status, project_id, assignee_id, page, page_size }) {
  assertValidStatus(status);

  const limit = Math.min(100, parseInt(page_size) || 20);
  const offset = ((parseInt(page) || 1) - 1) * limit;

  return tasksQueries.listTasks({
    status: status || undefined,
    projectId: project_id ? parseInt(project_id) : undefined,
    assigneeId: assignee_id ? parseInt(assignee_id) : undefined,
    limit,
    offset
  });
}

function getTaskById(id) {
  const taskId = parseInt(id);
  const task = tasksQueries.findTaskById(taskId);
  if (!task) return null;
  task.tags = tagsQueries.listTagsForTask(taskId);
  task.comments = commentsQueries.listCommentsForTask(taskId);
  return task;
}

function createTask({ title, description, project_id, assignee_id, due_date }) {
  if (!isNonEmptyString(title)) throw httpError(400, 'title is required');
  if (project_id && !projectsQueries.findProjectById(parseInt(project_id))) {
    throw httpError(400, 'project not found');
  }
  if (assignee_id && !usersQueries.findUserById(parseInt(assignee_id))) {
    throw httpError(400, 'assignee not found');
  }

  const result = tasksQueries.insertTask({
    title,
    description: description || null,
    projectId: project_id ? parseInt(project_id) : null,
    assigneeId: assignee_id ? parseInt(assignee_id) : null,
    dueDate: due_date || null
  });
  return tasksQueries.findTaskById(result.lastInsertRowid);
}

// completed_at is set when a task becomes completed and cleared when it moves away.
function completedAtFor(existing, newStatus) {
  if (newStatus !== 'completed') return null;
  if (existing.status !== 'completed') return new Date().toISOString();
  return existing.completed_at;
}

function updateTask(id, data) {
  const taskId = parseInt(id);
  const existing = tasksQueries.findTaskById(taskId);
  if (!existing) throw httpError(404, 'Task not found');

  const { title, description, status, project_id, assignee_id, due_date } = data;
  assertValidStatus(status);

  const updatedStatus = status !== undefined ? status : existing.status;
  tasksQueries.updateTask(taskId, {
    title: title !== undefined ? title : existing.title,
    description: description !== undefined ? description : existing.description,
    status: updatedStatus,
    projectId: project_id !== undefined ? project_id : existing.project_id,
    assigneeId: assignee_id !== undefined ? assignee_id : existing.assignee_id,
    dueDate: due_date !== undefined ? due_date : existing.due_date,
    completedAt: completedAtFor(existing, updatedStatus)
  });
  return tasksQueries.findTaskById(taskId);
}

function deleteTask(id) {
  const result = tasksQueries.deleteTask(parseInt(id));
  if (result.changes === 0) throw httpError(404, 'Task not found');
  return { deleted: true };
}

module.exports = { listTasks, getTaskById, createTask, updateTask, deleteTask };
