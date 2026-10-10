// Sends errors passed to next() as { error: message }. Expected (4xx) errors aren't logged.
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) console.error(err.stack || err);
  res.status(status).json({ error: err.message || 'Internal server error' });
}

module.exports = { errorHandler };
