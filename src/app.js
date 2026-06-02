const express = require('express');
const config = require('./config');
const { createLogger } = require('./logger');
const { createRequestContextMiddleware, createShutdownGuard } = require('./middleware/requestContext');
const TaskRepository = require('./db/taskRepository');
const TaskService = require('./services/taskService');
const { createSessionStore } = require('./session/sessionStore');
const createApiRouter = require('./routes/apiRoutes');
const createPageRouter = require('./routes/pageRoutes');

async function createApp(options = {}) {
  const appConfig = options.config || config;
  const logger = options.logger || createLogger(appConfig);
  const app = express();
  const taskRepository = await TaskRepository.create(appConfig, { logger });
  const taskService = new TaskService(taskRepository);
  const sessionStore = options.sessionStore || await createSessionStore(appConfig, logger);
  const dependencies = { config: appConfig, taskService, sessionStore };

  app.locals.isShuttingDown = false;
  app.locals.runtime = {
    config: appConfig,
    logger,
    taskRepository,
    sessionStore,
  };

  app.use(createRequestContextMiddleware({ logger }));
  app.use(createShutdownGuard(app));
  app.use(express.json());
  app.use(express.static('public'));
  app.use('/api', createApiRouter(dependencies));
  app.use('/', createPageRouter(dependencies));

  app.use((error, request, response, next) => {
    const requestLogger = request.log || logger;
    const statusCode = error.message === 'Task title is required.' ? 400 : 500;

    requestLogger.error('http.request.failed', {
      method: request.method,
      path: request.originalUrl,
      statusCode,
      error,
    });

    response.status(statusCode).json({
      message: 'Application error',
      details: error.message,
      requestId: request.requestId,
    });
  });

  return app;
}

module.exports = createApp;
