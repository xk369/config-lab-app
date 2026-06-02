const config = require('./config');
const { createLogger } = require('./logger');
const { startServer } = require('./server');
const { migrate, createAdmin, clearCache } = require('./commands');

async function main(argv = process.argv.slice(2)) {
  const [command = 'server', ...args] = argv;
  const logger = createLogger(config);

  if (command === 'server') {
    await startServer({ config, logger });
    return;
  }

  if (command === 'migrate') {
    await migrate(config, logger);
    return;
  }

  if (command === 'create-admin') {
    await createAdmin(config, logger, args);
    return;
  }

  if (command === 'clear-cache') {
    await clearCache(config, logger);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

if (require.main === module) {
  main().catch((error) => {
    const logger = createLogger(config);
    logger.error('command.failed', {
      command: process.argv[2] || 'server',
      error,
    });
    process.exit(1);
  });
}

module.exports = {
  main,
};
