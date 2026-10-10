// Builds an Error that the shared error handler turns into { error: message } with this status.
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = { httpError };
