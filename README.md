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
