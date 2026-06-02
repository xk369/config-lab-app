const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Writable } = require('node:stream');

function createSilentLogger() {
  const stream = new Writable({
    write(chunk, encoding, callback) {
      callback();
    },
  });
  const { Logger } = require('../src/logger');

  return new Logger({
    serviceName: 'test',
    stdout: stream,
    stderr: stream,
  });
}

test('configuration reads runtime values from environment-friendly defaults', () => {
  const { loadConfig } = require('../src/config');
  const config = loadConfig({
    env: {},
    cwd: path.join(__dirname, '..'),
    loadEnvFile: false,
  });

  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.port, 3001);
  assert.equal(config.shutdownTimeoutMs, 10000);
  assert.equal(config.shutdownDrainMs, 500);
  assert.equal(path.isAbsolute(config.dataFile), true);
  assert.equal(config.database.autoMigrate, true);
  assert.equal(config.database.client, 'sqlite');
  assert.equal(path.isAbsolute(config.database.sqliteFile), true);
  assert.equal(config.sessions.store, 'memory');
  assert.equal(config.releaseVersion, 'local-dev');
});

test('environment variables override yaml configuration file', () => {
  const { loadConfig, toPublicConfig } = require('../src/config');
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'config-lab-app-'));
  const configFile = path.join(tempDirectory, 'local.yaml');

  fs.writeFileSync(
    configFile,
    [
      'app:',
      '  name: YAML Config App',
      '  env: yaml-local',
      '  releaseVersion: yaml-release',
      'server:',
      '  host: 127.0.0.1',
      '  port: 4100',
      '  shutdownTimeoutMs: 7000',
      '  shutdownDrainMs: 300',
      'storage:',
      '  dataFile: data/from-yaml.json',
      'database:',
      '  autoMigrate: false',
      '  client: sqlite',
      '  sqliteFile: data/from-yaml.sqlite',
      '  postgres:',
      '    host: yaml-postgres',
      '    port: 15432',
      '    name: yaml_db',
      '    user: yaml_user',
      '    password: yaml-password',
      'sessions:',
      '  store: redis',
      '  redisUrl: redis://yaml-redis:6379',
      'externalService:',
      '  url: https://yaml.example/api',
      '  apiToken: yaml-secret',
      'runtime:',
      '  instanceId: yaml-instance',
      'logging:',
      '  level: debug',
      '',
    ].join('\n')
  );

  const config = loadConfig({
    cwd: tempDirectory,
    loadEnvFile: false,
    env: {
      CONFIG_FILE: configFile,
      APP_ENV: 'env-staging',
      PORT: '5050',
      DB_CLIENT: 'postgres',
      DATABASE_HOST: 'env-postgres',
      DATABASE_PASSWORD: 'env-password',
      SESSION_STORE: 'memory',
      EXTERNAL_SERVICE_URL: 'https://env.example/api',
      API_TOKEN: 'env-secret',
      RELEASE_VERSION: 'env-release',
      INSTANCE_ID: 'env-instance',
    },
  });

  assert.equal(config.appName, 'YAML Config App');
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.env, 'env-staging');
  assert.equal(config.port, 5050);
  assert.equal(config.shutdownTimeoutMs, 7000);
  assert.equal(config.shutdownDrainMs, 300);
  assert.equal(config.database.autoMigrate, false);
  assert.equal(config.database.client, 'postgres');
  assert.equal(config.database.postgres.host, 'env-postgres');
  assert.equal(config.database.postgres.port, 15432);
  assert.equal(config.database.postgres.database, 'yaml_db');
  assert.equal(config.database.postgres.user, 'yaml_user');
  assert.equal(config.database.postgres.password, 'env-password');
  assert.equal(config.externalServiceUrl, 'https://env.example/api');
  assert.equal(config.apiToken, 'env-secret');
  assert.equal(config.sessions.store, 'memory');
  assert.equal(config.sessions.redisUrl, 'redis://yaml-redis:6379');
  assert.equal(config.releaseVersion, 'env-release');
  assert.equal(config.instanceId, 'env-instance');
  assert.equal(config.logLevel, 'debug');

  const publicConfig = toPublicConfig(config);
  assert.equal(publicConfig.apiTokenConfigured, true);
  assert.equal(publicConfig.databaseClient, 'postgres');
  assert.equal(publicConfig.postgresHost, 'env-postgres');
  assert.equal(publicConfig.sessionStore, 'memory');
  assert.equal(publicConfig.releaseVersion, 'env-release');
  assert.equal(Object.prototype.hasOwnProperty.call(publicConfig, 'apiToken'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(publicConfig, 'databasePassword'), false);
});

test('sqlite repository stores application state outside the process memory', async () => {
  const { loadConfig } = require('../src/config');
  const TaskRepository = require('../src/db/taskRepository');
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'config-lab-app-db-'));
  const sqliteFile = path.join(tempDirectory, 'tasks.sqlite');
  const config = loadConfig({
    cwd: tempDirectory,
    loadEnvFile: false,
    env: {
      DB_CLIENT: 'sqlite',
      SQLITE_FILE: sqliteFile,
    },
  });

  const repository = await TaskRepository.create(config);
  const seededTasks = await repository.findAll();
  const createdTask = await repository.create({
    title: 'Запись хранится в SQLite',
    status: 'done',
  });
  const tasksAfterCreate = await repository.findAll();

  assert.equal(seededTasks.length, 3);
  assert.equal(createdTask.title, 'Запись хранится в SQLite');
  assert.equal(tasksAfterCreate.length, 4);
  assert.equal(fs.existsSync(sqliteFile), true);

  await repository.close();
});

test('database migrations and admin command are idempotent', async () => {
  const { loadConfig } = require('../src/config');
  const TaskRepository = require('../src/db/taskRepository');
  const { runMigrations } = require('../src/db/migrations');
  const { createAdminUser } = require('../src/db/adminRepository');
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'config-lab-app-migrate-'));
  const sqliteFile = path.join(tempDirectory, 'tasks.sqlite');
  const logger = createSilentLogger();
  const config = loadConfig({
    cwd: tempDirectory,
    loadEnvFile: false,
    env: {
      AUTO_MIGRATE: 'false',
      DB_CLIENT: 'sqlite',
      SQLITE_FILE: sqliteFile,
    },
  });

  const firstRun = await runMigrations(config, logger);
  const secondRun = await runMigrations(config, logger);
  const repository = await TaskRepository.create(config, { logger });
  const admin = await createAdminUser(config, {
    email: 'admin@example.com',
    role: 'admin',
  });

  assert.deepEqual(firstRun.applied, ['001_create_tasks', '002_create_admin_users']);
  assert.deepEqual(secondRun.applied, []);
  assert.deepEqual(secondRun.skipped, ['001_create_tasks', '002_create_admin_users']);
  assert.equal((await repository.findAll()).length, 3);
  assert.equal(admin.email, 'admin@example.com');

  await repository.close();
});

test('request context middleware preserves X-Request-ID for tracing', () => {
  const { createRequestContextMiddleware } = require('../src/middleware/requestContext');
  const logger = createSilentLogger();
  const middleware = createRequestContextMiddleware({ logger });
  const request = new EventEmitter();
  const response = new EventEmitter();
  const headers = {};
  let nextCalled = false;

  request.get = (name) => (name === 'X-Request-ID' ? 'test-request-id' : '');
  request.method = 'GET';
  request.originalUrl = '/api/health';
  response.statusCode = 200;
  response.setHeader = (name, value) => {
    headers[name.toLowerCase()] = value;
  };

  middleware(request, response, () => {
    nextCalled = true;
  });
  response.emit('finish');

  assert.equal(nextCalled, true);
  assert.equal(request.requestId, 'test-request-id');
  assert.equal(headers['x-request-id'], 'test-request-id');
});

test('source files do not contain hardcoded local user paths', () => {
  const projectRoot = path.join(__dirname, '..');
  const forbiddenPathPatterns = [
    `/${'Users'}/`,
    `/${'home'}/`,
    `C:\\${'Users'}\\`,
  ];
  const ignoredDirectories = new Set(['.git', 'node_modules', 'data', 'reports']);
  const filesToCheck = [];

  function collectFiles(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) {
          collectFiles(path.join(directory, entry.name));
        }
        continue;
      }

      filesToCheck.push(path.join(directory, entry.name));
    }
  }

  collectFiles(projectRoot);

  for (const filePath of filesToCheck) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const pattern of forbiddenPathPatterns) {
      assert.equal(
        content.includes(pattern),
        false,
        `${path.relative(projectRoot, filePath)} contains forbidden local path pattern ${pattern}`
      );
    }
  }
});
