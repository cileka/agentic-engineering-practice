const usersQueries = require('../db/queries/users');
const { sendEmail } = require('./email');
const { validateEmail, isNonEmptyString } = require('../utils/validation');
const { httpError } = require('../utils/http-error');

function listUsers() {
  return usersQueries.listUsers();
}

function getUserById(id) {
  return usersQueries.findUserById(parseInt(id));
}

async function createUser({ name, email }) {
  if (!isNonEmptyString(name)) throw httpError(400, 'name is required');
  if (!isNonEmptyString(email)) throw httpError(400, 'email is required');
  if (!validateEmail(email)) throw httpError(400, 'Invalid email address');

  let result;
  try {
    result = usersQueries.insertUser(name, email);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) throw httpError(409, 'email already exists');
    throw err;
  }
  const user = usersQueries.findUserById(result.lastInsertRowid);

  await sendEmail({
    to: user.email,
    subject: 'Welcome to Taskr!',
    body: `Hi ${user.name}, your account is ready. Start managing your tasks at taskr.io.`
  });

  return user;
}

function updateUser(id, data) {
  const userId = parseInt(id);
  const existing = usersQueries.findUserById(userId);
  if (!existing) throw httpError(404, 'User not found');

  const name = data.name !== undefined ? data.name : existing.name;
  const email = data.email !== undefined ? data.email : existing.email;
  usersQueries.updateUser(userId, name, email);
  return usersQueries.findUserById(userId);
}

function deleteUser(id) {
  const result = usersQueries.deleteUser(parseInt(id));
  if (result.changes === 0) throw httpError(404, 'User not found');
  return { deleted: true };
}

module.exports = { listUsers, getUserById, createUser, updateUser, deleteUser };
