const express = require('express');
const config = require('./config');
const TaskRepository = require('./db/taskRepository');
const TaskService = require('./services/taskService');
const createApiRouter = require('./routes/apiRoutes');
const createPageRouter = require('./routes/pageRoutes');

async function createApp() {
  const app = express();
  const taskRepository = await TaskRepository.create(config);
  const taskService = new TaskService(taskRepository);
  const dependencies = { config, taskService };

  app.use(express.json());
  app.use(express.static('public'));
  app.use('/api', createApiRouter(dependencies));
  app.use('/', createPageRouter(dependencies));

  app.use((error, request, response, next) => {
    console.error(error);
    const statusCode = error.message === 'Task title is required.' ? 400 : 500;

    response.status(statusCode).json({
      message: 'Application error',
      details: error.message,
    });
  });

  return app;
}

module.exports = createApp;
