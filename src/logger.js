const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

class Logger {
  constructor(options = {}) {
    this.serviceName = options.serviceName || 'config-lab-app';
    this.level = String(options.level || 'info').toLowerCase();
    this.defaultContext = options.defaultContext || {};
    this.stdout = options.stdout || process.stdout;
    this.stderr = options.stderr || process.stderr;
  }

  child(context = {}) {
    return new Logger({
      serviceName: this.serviceName,
      level: this.level,
      defaultContext: {
        ...this.defaultContext,
        ...context,
      },
      stdout: this.stdout,
      stderr: this.stderr,
    });
  }

  debug(message, context) {
    this.write('debug', message, context);
  }

  info(message, context) {
    this.write('info', message, context);
  }

  warn(message, context) {
    this.write('warn', message, context);
  }

  error(message, context) {
    this.write('error', message, context);
  }

  write(level, message, context = {}) {
    if (!this.shouldLog(level)) {
      return;
    }

    const payload = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      ...this.defaultContext,
      ...normalizeContext(context),
    };
    const line = `${JSON.stringify(payload)}\n`;
    const stream = level === 'error' ? this.stderr : this.stdout;

    stream.write(line);
  }

  shouldLog(level) {
    const configuredLevel = LEVELS[this.level] || LEVELS.info;
    const currentLevel = LEVELS[level] || LEVELS.info;
    return currentLevel >= configuredLevel;
  }
}

function normalizeContext(context) {
  const normalized = {};

  for (const [key, value] of Object.entries(context || {})) {
    if (value instanceof Error) {
      normalized[key] = {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
      continue;
    }

    normalized[key] = value;
  }

  return normalized;
}

function createLogger(config, streams = {}) {
  return new Logger({
    serviceName: config.appName,
    level: config.logLevel,
    stdout: streams.stdout,
    stderr: streams.stderr,
    defaultContext: {
      env: config.env,
      releaseVersion: config.releaseVersion,
      instanceId: config.instanceId,
    },
  });
}

module.exports = {
  Logger,
  createLogger,
};
