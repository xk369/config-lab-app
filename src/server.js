const config = require('./config');
const createApp = require('./app');

const app = createApp();

app.listen(config.port, config.host, () => {
  console.log(`${config.appName} is running at http://${config.host}:${config.port}`);
});
