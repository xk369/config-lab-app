const path = require('node:path');

const config = {
  appName: process.env.APP_NAME || 'Config Lab App',
  env: process.env.APP_ENV || 'development',
  host: process.env.HOST || '0.0.0.0',
  port: Number(process.env.PORT || 3001),
  dataFile: process.env.DATA_FILE || path.join(process.cwd(), 'data', 'tasks.runtime.json'),
};

module.exports = config;
