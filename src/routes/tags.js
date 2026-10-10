const express = require('express');
const tagsService = require('../services/tags');

// Mounted at /tags
const tagsRouter = express.Router();

tagsRouter.get('/', (req, res, next) => {
  try {
    res.json(tagsService.listTags());
  } catch (err) {
    next(err);
  }
});

tagsRouter.post('/', (req, res, next) => {
  try {
    const tag = tagsService.createTag(req.body);
    res.status(201).json(tag);
  } catch (err) {
    next(err);
  }
});

// Mounted at /tasks/:taskId/tags
const taskTagsRouter = express.Router({ mergeParams: true });

taskTagsRouter.post('/', (req, res, next) => {
  try {
    const link = tagsService.addTagToTask(req.params.taskId, req.body);
    res.status(201).json(link);
  } catch (err) {
    next(err);
  }
});

taskTagsRouter.delete('/:tagId', (req, res, next) => {
  try {
    res.json(tagsService.removeTagFromTask(req.params.taskId, req.params.tagId));
  } catch (err) {
    next(err);
  }
});

module.exports = { tagsRouter, taskTagsRouter };
