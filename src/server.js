const config = require('./config');
const createApp = require('./app');

async function startServer() {
  const app = await createApp();

  app.listen(config.port, config.host, () => {
    console.log(`${config.appName} is running at http://${config.host}:${config.port}`);
  });
}

startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
