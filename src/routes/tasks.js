const express = require('express');
const tasksService = require('../services/tasks');

const tasksRouter = express.Router();

tasksRouter.get('/', (req, res, next) => {
  try {
    res.json(tasksService.listTasks(req.query));
  } catch (err) {
    next(err);
  }
});

tasksRouter.post('/', (req, res, next) => {
  try {
    const task = tasksService.createTask(req.body);
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

tasksRouter.get('/:id', (req, res, next) => {
  try {
    const task = tasksService.getTaskById(req.params.id);
    if (!task) return next({ status: 404, message: 'Task not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

tasksRouter.put('/:id', (req, res, next) => {
  try {
    res.json(tasksService.updateTask(req.params.id, req.body));
  } catch (err) {
    next(err);
  }
});

tasksRouter.delete('/:id', (req, res, next) => {
  try {
    res.json(tasksService.deleteTask(req.params.id));
  } catch (err) {
    next(err);
  }
});

module.exports = { tasksRouter };
