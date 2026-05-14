# Config Lab App

Небольшое модульное веб-приложение для практических работ по отделению кода от конфигурации и контейнеризации.

## Запуск локально

```bash
npm install
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
- `APP_ENV` - имя окружения.
- `DATA_FILE` - путь к JSON-файлу с данными.
- `APP_NAME` - название приложения.
- `CONFIG_FILE` - путь к YAML-файлу конфигурации.
- `DB_CLIENT` - тип хранилища состояния: `sqlite` или `postgres`.
- `SQLITE_FILE` - путь к локальной SQLite-БД для запуска без Docker.
- `DATABASE_HOST` - хост PostgreSQL.
- `DATABASE_PORT` - порт PostgreSQL.
- `DATABASE_NAME` - имя базы данных PostgreSQL.
- `DATABASE_USER` - пользователь PostgreSQL.
- `DATABASE_PASSWORD` - пароль PostgreSQL.
- `DATABASE_SSL` - включение SSL для PostgreSQL.
- `EXTERNAL_SERVICE_URL` - адрес внешнего API.
- `API_TOKEN` - секретный токен внешнего API.
- `LOG_LEVEL` - уровень логирования.

## Структура

- `src/config.js` - чтение конфигурации из окружения.
- `src/db/taskRepository.js` - работа с JSON-хранилищем.
- `src/services/taskService.js` - бизнес-логика.
- `src/routes` - HTTP-маршруты.
- `src/server.js` - точка запуска приложения.

## Docker

```bash
docker build -t config-lab-app:1.0 .
docker run --rm -p 8080:8080 config-lab-app:1.0
```

Один и тот же образ можно запускать с разными переменными окружения без пересборки:

```bash
docker run --rm -p 5100:5100 \
  -e PORT=5100 \
  -e APP_ENV=staging \
  -e APP_NAME="Config Lab App Staging" \
  -e EXTERNAL_SERVICE_URL=https://staging.example/api \
  config-lab-app:1.0

docker run --rm -p 7100:7100 \
  -e PORT=7100 \
  -e APP_ENV=prod \
  -e APP_NAME="Config Lab App Prod" \
  -e EXTERNAL_SERVICE_URL=https://prod.example/api \
  config-lab-app:1.0
```

## Внешняя база данных

Локально приложение по умолчанию использует SQLite:

```bash
DB_CLIENT=sqlite SQLITE_FILE=data/tasks.sqlite npm start
```

В Docker Compose состояние хранится во внешнем сервисе PostgreSQL:

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
