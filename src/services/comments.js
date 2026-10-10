const commentsQueries = require('../db/queries/comments');
const tasksQueries = require('../db/queries/tasks');
const usersQueries = require('../db/queries/users');
const { isNonEmptyString } = require('../utils/validation');
const { httpError } = require('../utils/http-error');

function assertTaskExists(taskId) {
  if (!tasksQueries.findTaskById(taskId)) throw httpError(404, 'Task not found');
}

function listCommentsForTask(id) {
  const taskId = parseInt(id);
  assertTaskExists(taskId);
  return commentsQueries.listCommentsForTask(taskId);
}

function createComment(id, { user_id, body }) {
  const taskId = parseInt(id);
  assertTaskExists(taskId);

  if (!isNonEmptyString(body)) throw httpError(400, 'body is required');
  if (!user_id) throw httpError(400, 'user_id is required');
  const userId = parseInt(user_id);
  if (!usersQueries.findUserById(userId)) throw httpError(400, 'user not found');

  const result = commentsQueries.insertComment(taskId, userId, body);
  return commentsQueries.findCommentById(result.lastInsertRowid);
}

module.exports = { listCommentsForTask, createComment };
