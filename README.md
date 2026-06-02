# Config Lab App

Небольшое модульное веб-приложение для практических работ по отделению кода от конфигурации и контейнеризации.

## Запуск локально

```bash
npm install
npm run migrate
PORT=3001 npm start
```

## Конфигурация

Приложение не содержит локальных абсолютных путей. Поведение настраивается через менеджер конфигурации:

1. Значения по умолчанию в `src/config.js`.
2. YAML-файл для локальной разработки, например `config/local.yaml`.
3. Переменные окружения, которые имеют наивысший приоритет.

Для локальной настройки можно скопировать шаблоны:

```bash
cp .env.example .env
cp config/local.example.yaml config/local.yaml
```

Файлы `.env` и `config/local.yaml` не попадают в Git, потому что могут содержать реальные секреты.

Используемые переменные:

- `PORT` - порт HTTP-сервера.
- `HOST` - адрес прослушивания сервера.
- `SHUTDOWN_TIMEOUT_MS` - тайм-аут корректного завершения процесса.
- `SHUTDOWN_DRAIN_MS` - короткое окно, в котором новые запросы получают 503 после сигнала завершения.
- `APP_ENV` - имя окружения.
- `DATA_FILE` - путь к JSON-файлу с данными.
- `APP_NAME` - название приложения.
- `CONFIG_FILE` - путь к YAML-файлу конфигурации.
- `AUTO_MIGRATE` - включает автоматическое применение миграций при старте локального сервера.
- `DB_CLIENT` - тип хранилища состояния: `sqlite` или `postgres`.
- `SQLITE_FILE` - путь к локальной SQLite-БД для запуска без Docker.
- `DATABASE_HOST` - хост PostgreSQL.
- `DATABASE_PORT` - порт PostgreSQL.
- `DATABASE_NAME` - имя базы данных PostgreSQL.
- `DATABASE_USER` - пользователь PostgreSQL.
- `DATABASE_PASSWORD` - пароль PostgreSQL.
- `DATABASE_SSL` - включение SSL для PostgreSQL.
- `SESSION_STORE` - хранилище пользовательских сессий: `memory` или `redis`.
- `REDIS_URL` - адрес Redis для централизованных сессий.
- `EXTERNAL_SERVICE_URL` - адрес внешнего API.
- `API_TOKEN` - секретный токен внешнего API.
- `RELEASE_VERSION` - версия релиза или тег Docker-образа.
- `INSTANCE_ID` - идентификатор экземпляра приложения.
- `LOG_LEVEL` - уровень логирования.

## Структура

- `src/config.js` - чтение конфигурации из окружения.
- `src/db` - миграции, репозитории задач и административных пользователей.
- `src/session` - централизованное хранилище сессий.
- `src/logger.js` - структурное JSON-логирование в stdout/stderr.
- `src/services/taskService.js` - бизнес-логика.
- `src/routes` - HTTP-маршруты.
- `src/server.js` - запуск HTTP-сервера и graceful shutdown.
- `src/cli.js` - режимы запуска `server`, `migrate`, `create-admin`, `clear-cache`.

## Docker

```bash
docker build -t config-lab-app:1.5 .
docker run --rm -p 8080:8080 \
  -e HOST=0.0.0.0 \
  -e PORT=8080 \
  -e DB_CLIENT=sqlite \
  -e SQLITE_FILE=/app/data/tasks.sqlite \
  -e RELEASE_VERSION=manual-local \
  config-lab-app:1.5
```

Один и тот же образ можно запускать с разными переменными окружения без пересборки:

```bash
docker run --rm -p 5100:5100 \
  -e HOST=0.0.0.0 \
  -e PORT=5100 \
  -e APP_ENV=staging \
  -e APP_NAME="Config Lab App Staging" \
  -e RELEASE_VERSION=sha-abc123 \
  -e EXTERNAL_SERVICE_URL=https://staging.example/api \
  config-lab-app:1.5

docker run --rm -p 7100:7100 \
  -e HOST=0.0.0.0 \
  -e PORT=7100 \
  -e APP_ENV=prod \
  -e APP_NAME="Config Lab App Prod" \
  -e RELEASE_VERSION=sha-abc123 \
  -e EXTERNAL_SERVICE_URL=https://prod.example/api \
  config-lab-app:1.5
```

## Внешняя база данных

Локально приложение по умолчанию использует SQLite:

```bash
DB_CLIENT=sqlite SQLITE_FILE=data/tasks.sqlite npm start
```

В Docker Compose состояние хранится во внешнем сервисе PostgreSQL, а пользовательские сессии - в Redis:

```bash
docker compose up --build --scale app=3 -d
docker compose ps
```

Создание записи через API:

```bash
curl -X POST http://localhost:<published-port>/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Запись хранится во внешней PostgreSQL","status":"done"}'
```

## CI, релиз и масштабирование

Workflow `.github/workflows/build-release.yml` при каждом push в `main`:

1. запускает тесты;
2. собирает Docker-образ;
3. тегирует его commit hash и номером сборки;
4. публикует образ в GitHub Container Registry;
5. описывает staging/production-релиз как комбинацию фиксированного образа и переменных окружения.

Локально горизонтальное масштабирование проверяется через nginx-балансировщик:

```bash
docker compose up --build --scale app=3 -d
npm run load-test -- http://localhost:8080/api/session 30
```

В ответе нагрузочного теста видно, сколько запросов обработал каждый `instanceId`. Сессия сохраняется в Redis, поэтому один и тот же пользователь не теряет счетчик при попадании на разные экземпляры приложения.

## Логирование и трассировка

Все логи пишутся как JSON-события в stdout/stderr. Каждый HTTP-запрос получает `X-Request-ID`; если клиент передал этот заголовок, приложение использует его, иначе генерирует новый.

```bash
curl -H "X-Request-ID: demo-request" http://localhost:8080/api/health
docker compose logs -f app
```

## Корректное завершение

Приложение обрабатывает `SIGTERM` и `SIGINT`: перестает принимать новые запросы, ожидает завершения уже начатых запросов, закрывает соединения с PostgreSQL/Redis и завершает процесс.

```bash
curl http://localhost:8080/api/slow?ms=5000
docker kill --signal=SIGTERM <container_id>
```

## Административные команды

Один и тот же Docker-образ может запускаться в разных режимах:

```bash
node src/cli.js server
node src/cli.js migrate
node src/cli.js create-admin --email=admin@example.com
node src/cli.js clear-cache
```

Для запуска миграций отдельным контейнером:

```bash
docker compose run --rm migrate
```

Для ручного создания администратора без входа внутрь работающего контейнера:

```bash
docker compose run --rm app node src/cli.js create-admin --email=admin@example.com
```
