const express = require('express');

function createApiRouter({ taskService, config }) {
  const router = express.Router();

  router.get('/health', (request, response) => {
    response.json({
      status: 'ok',
      app: config.appName,
      env: config.env,
    });
  });

  router.get('/tasks', async (request, response, next) => {
    try {
      const tasks = await taskService.listTasks();
      response.json(tasks);
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
