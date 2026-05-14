const express = require('express');

function createPageRouter({ taskService, config }) {
  const router = express.Router();

  router.get('/', async (request, response, next) => {
    try {
      const tasks = await taskService.listTasks();
      const summary = await taskService.getSummary();

      response.send(renderHomePage({ config, tasks, summary }));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function renderHomePage({ config, tasks, summary }) {
  const taskItems = tasks.map((task) => `
    <li class="task task-${task.status}">
      <span>${task.title}</span>
      <strong>${task.status}</strong>
    </li>
  `).join('');

  return `<!doctype html>
    <html lang="ru">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${config.appName}</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <main class="shell">
          <section class="hero">
            <p class="eyebrow">12-factor practice</p>
            <h1>${config.appName}</h1>
            <p>
              Приложение отделяет код от конфигурации: окружение, порт и файл
              данных задаются через переменные окружения, а не через локальные
              пути внутри исходного кода. YAML-файл можно использовать для
              локальной разработки, а переменные окружения имеют приоритет.
            </p>
          </section>

          <section class="grid">
            <article>
              <span>Окружение</span>
              <strong>${config.env}</strong>
            </article>
            <article>
              <span>Всего задач</span>
              <strong>${summary.total}</strong>
            </article>
            <article>
              <span>Выполнено</span>
              <strong>${summary.completed}</strong>
            </article>
          </section>

          <section class="config-grid">
            <article>
              <span>Порт</span>
              <strong>${config.port}</strong>
            </article>
            <article>
              <span>Внешний API</span>
              <strong>${config.externalServiceUrl}</strong>
            </article>
            <article>
              <span>API token</span>
              <strong>${config.apiToken ? 'configured' : 'not set'}</strong>
            </article>
            <article>
              <span>YAML config</span>
              <strong>${config.configFile ? 'loaded' : 'not used'}</strong>
            </article>
            <article>
              <span>База данных</span>
              <strong>${config.database.client}</strong>
            </article>
            <article>
              <span>DB host</span>
              <strong>${config.database.client === 'postgres' ? config.database.postgres.host : 'local sqlite'}</strong>
            </article>
          </section>

          <section class="panel">
            <h2>Модульная структура</h2>
            <ul>${taskItems}</ul>
          </section>
        </main>
      </body>
    </html>`;
}

module.exports = createPageRouter;
