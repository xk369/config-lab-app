const config = require('./config');
const createApp = require('./app');
const { createLogger } = require('./logger');

async function startServer(options = {}) {
  const appConfig = options.config || config;
  const logger = options.logger || createLogger(appConfig);
  const startedAt = Date.now();
  const app = await createApp({ config: appConfig, logger });
  const server = app.listen(appConfig.port, appConfig.host, () => {
    logger.info('server.started', {
      url: `http://${appConfig.host}:${appConfig.port}`,
      startupMs: Date.now() - startedAt,
      releaseVersion: appConfig.releaseVersion,
      env: appConfig.env,
    });
  });
  const shutdown = createGracefulShutdown({
    app,
    server,
    logger,
    timeoutMs: appConfig.shutdownTimeoutMs,
    drainMs: appConfig.shutdownDrainMs,
    exitOnShutdown: options.exitOnShutdown !== false,
  });

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  return { app, server, shutdown };
}

function createGracefulShutdown({ app, server, logger, timeoutMs, drainMs = 0, exitOnShutdown }) {
  let isShuttingDown = false;

  return async function shutdown(signal = 'manual') {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    app.locals.isShuttingDown = true;
    logger.info('shutdown.started', { signal, timeoutMs, drainMs });

    const forceExitTimer = setTimeout(() => {
      logger.error('shutdown.timeout', { signal, timeoutMs });

      if (exitOnShutdown) {
        process.exit(1);
      }
    }, timeoutMs);

    if (drainMs > 0) {
      await delay(drainMs);
    }

    await new Promise((resolve) => {
      server.close(resolve);
    });

    await closeRuntime(app, logger);
    clearTimeout(forceExitTimer);
    logger.info('shutdown.completed', { signal });

    if (exitOnShutdown) {
      process.exit(0);
    }
  };
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function closeRuntime(app, logger) {
  const runtime = app.locals.runtime || {};

  await Promise.allSettled([
    runtime.taskRepository?.close(),
    runtime.sessionStore?.close(),
  ]).then((results) => {
    for (const result of results) {
      if (result.status === 'rejected') {
        logger.error('shutdown.resource_close_failed', { error: result.reason });
      }
    }
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    const logger = createLogger(config);
    logger.error('server.start_failed', { error });
    process.exit(1);
  });
}

module.exports = {
  startServer,
  createGracefulShutdown,
};
