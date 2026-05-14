const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const yaml = require('js-yaml');

function createDefaults(cwd) {
  return {
    appName: 'Config Lab App',
    env: 'development',
    host: '0.0.0.0',
    port: 3001,
    dataFile: path.join(cwd, 'data', 'tasks.runtime.json'),
    databaseClient: 'sqlite',
    sqliteFile: path.join(cwd, 'data', 'tasks.sqlite'),
    databaseHost: 'localhost',
    databasePort: 5432,
    databaseName: 'config_lab_app',
    databaseUser: 'config_lab_app',
    databasePassword: '',
    databaseSsl: false,
    externalServiceUrl: 'https://api.example.local',
    apiToken: '',
    logLevel: 'info',
  };
}

function readYamlConfig(configFile, cwd) {
  if (!configFile) {
    return { values: {}, source: null };
  }

  const absoluteConfigFile = path.isAbsolute(configFile)
    ? configFile
    : path.join(cwd, configFile);

  if (!fs.existsSync(absoluteConfigFile)) {
    return { values: {}, source: null };
  }

  const content = fs.readFileSync(absoluteConfigFile, 'utf8');
  return {
    values: yaml.load(content) || {},
    source: absoluteConfigFile,
  };
}

function getNestedValue(source, pathSegments) {
  return pathSegments.reduce((currentValue, segment) => {
    if (currentValue && Object.prototype.hasOwnProperty.call(currentValue, segment)) {
      return currentValue[segment];
    }

    return undefined;
  }, source);
}

function getValue({ env, yamlValues, envName, yamlPath, defaultValue }) {
  const envValue = env[envName];

  if (envValue !== undefined && envValue !== '') {
    return envValue;
  }

  const yamlValue = getNestedValue(yamlValues, yamlPath);

  if (yamlValue !== undefined && yamlValue !== null && yamlValue !== '') {
    return yamlValue;
  }

  return defaultValue;
}

function getNumberValue(options) {
  const value = Number(getValue(options));

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${options.envName} must be a positive number.`);
  }

  return value;
}

function getBooleanValue(options) {
  const value = getValue(options);

  if (typeof value === 'boolean') {
    return value;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function resolveConfigPath(value, cwd) {
  return path.isAbsolute(value) ? value : path.join(cwd, value);
}

function loadConfig(options = {}) {
  const cwd = options.cwd || process.cwd();
  const env = options.env || process.env;

  if (options.loadEnvFile !== false) {
    dotenv.config({
      path: env.ENV_FILE || path.join(cwd, '.env'),
      override: false,
      quiet: true,
    });
  }

  const defaults = createDefaults(cwd);
  const localConfigFile = path.join(cwd, 'config', 'local.yaml');
  const configFile = env.CONFIG_FILE || (fs.existsSync(localConfigFile) ? localConfigFile : '');
  const yamlConfig = readYamlConfig(configFile, cwd);

  const dataFile = getValue({
    env,
    yamlValues: yamlConfig.values,
    envName: 'DATA_FILE',
    yamlPath: ['storage', 'dataFile'],
    defaultValue: defaults.dataFile,
  });
  const sqliteFile = getValue({
    env,
    yamlValues: yamlConfig.values,
    envName: 'SQLITE_FILE',
    yamlPath: ['database', 'sqliteFile'],
    defaultValue: defaults.sqliteFile,
  });

  const config = {
    appName: getValue({
      env,
      yamlValues: yamlConfig.values,
      envName: 'APP_NAME',
      yamlPath: ['app', 'name'],
      defaultValue: defaults.appName,
    }),
    env: getValue({
      env,
      yamlValues: yamlConfig.values,
      envName: 'APP_ENV',
      yamlPath: ['app', 'env'],
      defaultValue: defaults.env,
    }),
    host: getValue({
      env,
      yamlValues: yamlConfig.values,
      envName: 'HOST',
      yamlPath: ['server', 'host'],
      defaultValue: defaults.host,
    }),
    port: getNumberValue({
      env,
      yamlValues: yamlConfig.values,
      envName: 'PORT',
      yamlPath: ['server', 'port'],
      defaultValue: defaults.port,
    }),
    dataFile: resolveConfigPath(dataFile, cwd),
    database: {
      client: getValue({
        env,
        yamlValues: yamlConfig.values,
        envName: 'DB_CLIENT',
        yamlPath: ['database', 'client'],
        defaultValue: defaults.databaseClient,
      }),
      sqliteFile: resolveConfigPath(sqliteFile, cwd),
      postgres: {
        host: getValue({
          env,
          yamlValues: yamlConfig.values,
          envName: 'DATABASE_HOST',
          yamlPath: ['database', 'postgres', 'host'],
          defaultValue: defaults.databaseHost,
        }),
        port: getNumberValue({
          env,
          yamlValues: yamlConfig.values,
          envName: 'DATABASE_PORT',
          yamlPath: ['database', 'postgres', 'port'],
          defaultValue: defaults.databasePort,
        }),
        database: getValue({
          env,
          yamlValues: yamlConfig.values,
          envName: 'DATABASE_NAME',
          yamlPath: ['database', 'postgres', 'name'],
          defaultValue: defaults.databaseName,
        }),
        user: getValue({
          env,
          yamlValues: yamlConfig.values,
          envName: 'DATABASE_USER',
          yamlPath: ['database', 'postgres', 'user'],
          defaultValue: defaults.databaseUser,
        }),
        password: getValue({
          env,
          yamlValues: yamlConfig.values,
          envName: 'DATABASE_PASSWORD',
          yamlPath: ['database', 'postgres', 'password'],
          defaultValue: defaults.databasePassword,
        }),
        ssl: getBooleanValue({
          env,
          yamlValues: yamlConfig.values,
          envName: 'DATABASE_SSL',
          yamlPath: ['database', 'postgres', 'ssl'],
          defaultValue: defaults.databaseSsl,
        }),
      },
    },
    externalServiceUrl: getValue({
      env,
      yamlValues: yamlConfig.values,
      envName: 'EXTERNAL_SERVICE_URL',
      yamlPath: ['externalService', 'url'],
      defaultValue: defaults.externalServiceUrl,
    }),
    apiToken: getValue({
      env,
      yamlValues: yamlConfig.values,
      envName: 'API_TOKEN',
      yamlPath: ['externalService', 'apiToken'],
      defaultValue: defaults.apiToken,
    }),
    logLevel: getValue({
      env,
      yamlValues: yamlConfig.values,
      envName: 'LOG_LEVEL',
      yamlPath: ['logging', 'level'],
      defaultValue: defaults.logLevel,
    }),
    configFile: yamlConfig.source,
  };

  config.sources = [
    'environment variables',
    config.configFile ? 'YAML config file' : null,
    'defaults',
  ].filter(Boolean);

  config.database.client = String(config.database.client).toLowerCase();

  if (!['sqlite', 'postgres'].includes(config.database.client)) {
    throw new Error('DB_CLIENT must be either sqlite or postgres.');
  }

  return config;
}

function toPublicConfig(config) {
  return {
    appName: config.appName,
    env: config.env,
    host: config.host,
    port: config.port,
    dataFile: config.dataFile,
    databaseClient: config.database.client,
    sqliteFile: config.database.client === 'sqlite' ? config.database.sqliteFile : null,
    postgresHost: config.database.client === 'postgres' ? config.database.postgres.host : null,
    postgresDatabase: config.database.client === 'postgres' ? config.database.postgres.database : null,
    externalServiceUrl: config.externalServiceUrl,
    apiTokenConfigured: Boolean(config.apiToken),
    logLevel: config.logLevel,
    configFile: config.configFile,
    sources: config.sources,
  };
}

const config = loadConfig();

module.exports = config;
module.exports.loadConfig = loadConfig;
module.exports.toPublicConfig = toPublicConfig;
