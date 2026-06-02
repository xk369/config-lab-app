const { createAdminUser } = require('./db/adminRepository');
const { runMigrations } = require('./db/migrations');
const { createSessionStore } = require('./session/sessionStore');

async function migrate(config, logger) {
  const result = await runMigrations(config, logger);
  logger.info('migrations.completed', result);
  return result;
}

async function createAdmin(config, logger, args) {
  const email = getArgumentValue(args, '--email');
  const role = getArgumentValue(args, '--role') || 'admin';

  if (!email) {
    throw new Error('Argument --email is required.');
  }

  const user = await createAdminUser(config, { email, role });
  logger.info('admin.created', {
    email: user.email,
    role: user.role,
  });
  return user;
}

async function clearCache(config, logger) {
  const sessionStore = await createSessionStore(config, logger);

  try {
    const result = await sessionStore.clear();
    logger.info('cache.cleared', result);
    return result;
  } finally {
    await sessionStore.close();
  }
}

function getArgumentValue(args, name) {
  const inlineArgument = args.find((arg) => arg.startsWith(`${name}=`));

  if (inlineArgument) {
    return inlineArgument.slice(name.length + 1);
  }

  const index = args.indexOf(name);
  return index === -1 ? '' : args[index + 1] || '';
}

module.exports = {
  migrate,
  createAdmin,
  clearCache,
};
