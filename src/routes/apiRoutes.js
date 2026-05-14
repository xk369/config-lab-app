const express = require('express');
const { toPublicConfig } = require('../config');

function createApiRouter({ taskService, config }) {
  const router = express.Router();

  router.get('/health', (request, response) => {
    response.json({
      status: 'ok',
      app: config.appName,
      env: config.env,
    });
  });

  router.get('/config', (request, response) => {
    response.json(toPublicConfig(config));
  });

  router.get('/tasks', async (request, response, next) => {
    try {
      const tasks = await taskService.listTasks();
      response.json(tasks);
    } catch (error) {
      next(error);
    }
  });

  router.post('/tasks', async (request, response, next) => {
    try {
      const task = await taskService.createTask(request.body);
      response.status(201).json(task);
    } catch (error) {
      next(error);
    }
  });

  router.get('/summary', async (request, response, next) => {
    try {
      const summary = await taskService.getSummary();
      response.json(summary);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createApiRouter;
