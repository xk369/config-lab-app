const express = require('express');
const config = require('./config');
const TaskRepository = require('./db/taskRepository');
const TaskService = require('./services/taskService');
const createApiRouter = require('./routes/apiRoutes');
const createPageRouter = require('./routes/pageRoutes');

function createApp() {
  const app = express();
  const taskRepository = new TaskRepository(config.dataFile);
  const taskService = new TaskService(taskRepository);
  const dependencies = { config, taskService };

  app.use(express.static('public'));
  app.use('/api', createApiRouter(dependencies));
  app.use('/', createPageRouter(dependencies));

  app.use((error, request, response, next) => {
    console.error(error);
    response.status(500).json({
      message: 'Application error',
      details: error.message,
    });
  });

  return app;
}

module.exports = createApp;
