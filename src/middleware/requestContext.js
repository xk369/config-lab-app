const crypto = require('node:crypto');

function createRequestContextMiddleware({ logger }) {
  return (request, response, next) => {
    const requestId = request.get('X-Request-ID') || crypto.randomUUID();
    const startedAt = process.hrtime.bigint();

    request.requestId = requestId;
    request.log = logger.child({ requestId });
    response.setHeader('X-Request-ID', requestId);

    response.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      request.log.info('http.request.completed', {
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
      });
    });

    next();
  };
}

function createShutdownGuard(app) {
  return (request, response, next) => {
    if (!app.locals.isShuttingDown) {
      next();
      return;
    }

    response.status(503).json({
      message: 'Service is shutting down',
      requestId: request.requestId,
    });
  };
}

module.exports = {
  createRequestContextMiddleware,
  createShutdownGuard,
};
