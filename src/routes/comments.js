const express = require('express');
const commentsService = require('../services/comments');

// Mounted at /tasks/:taskId/comments
const commentsRouter = express.Router({ mergeParams: true });

commentsRouter.get('/', (req, res, next) => {
  try {
    res.json(commentsService.listCommentsForTask(req.params.taskId));
  } catch (err) {
    next(err);
  }
});

commentsRouter.post('/', (req, res, next) => {
  try {
    const comment = commentsService.createComment(req.params.taskId, req.body);
    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
});

module.exports = { commentsRouter };
