const express = require('express');
const { PORT } = require('./config');
const { requestLogger } = require('./middleware/request-logger');
const { errorHandler } = require('./middleware/error-handler');
const { metaRouter } = require('./routes/meta');
const { webhooksRouter } = require('./routes/webhooks');
const router = require('../routes');

const app = express();

app.use(express.json());
app.use(requestLogger);

app.use('/', metaRouter);
app.use('/webhooks', webhooksRouter);
app.use(router);

app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Taskr API running on port ${PORT}`);
  });
}

module.exports = app;
