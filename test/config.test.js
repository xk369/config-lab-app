const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('configuration reads runtime values from environment-friendly defaults', () => {
  const { loadConfig } = require('../src/config');
  const config = loadConfig({
    env: {},
    cwd: path.join(__dirname, '..'),
    loadEnvFile: false,
  });

  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.port, 3001);
  assert.equal(path.isAbsolute(config.dataFile), true);
  assert.equal(config.database.client, 'sqlite');
  assert.equal(path.isAbsolute(config.database.sqliteFile), true);
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
      'server:',
      '  host: 127.0.0.1',
      '  port: 4100',
      'storage:',
      '  dataFile: data/from-yaml.json',
      'database:',
      '  client: sqlite',
      '  sqliteFile: data/from-yaml.sqlite',
      '  postgres:',
      '    host: yaml-postgres',
      '    port: 15432',
      '    name: yaml_db',
      '    user: yaml_user',
      '    password: yaml-password',
      'externalService:',
      '  url: https://yaml.example/api',
      '  apiToken: yaml-secret',
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
      EXTERNAL_SERVICE_URL: 'https://env.example/api',
      API_TOKEN: 'env-secret',
    },
  });

  assert.equal(config.appName, 'YAML Config App');
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.env, 'env-staging');
  assert.equal(config.port, 5050);
  assert.equal(config.database.client, 'postgres');
  assert.equal(config.database.postgres.host, 'env-postgres');
  assert.equal(config.database.postgres.port, 15432);
  assert.equal(config.database.postgres.database, 'yaml_db');
  assert.equal(config.database.postgres.user, 'yaml_user');
  assert.equal(config.database.postgres.password, 'env-password');
  assert.equal(config.externalServiceUrl, 'https://env.example/api');
  assert.equal(config.apiToken, 'env-secret');
  assert.equal(config.logLevel, 'debug');

  const publicConfig = toPublicConfig(config);
  assert.equal(publicConfig.apiTokenConfigured, true);
  assert.equal(publicConfig.databaseClient, 'postgres');
  assert.equal(publicConfig.postgresHost, 'env-postgres');
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
