const fs = require('node:fs/promises');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { Pool } = require('pg');

const initialTasks = [
  {
    title: 'Вынести настройки в переменные окружения',
    status: 'done',
  },
  {
    title: 'Разделить приложение на маршруты, сервисы и слой данных',
    status: 'done',
  },
  {
    title: 'Подготовить Dockerfile для повторяемого запуска',
    status: 'done',
  },
];

class TaskRepository {
  static async create(config) {
    const repository = config.database.client === 'postgres'
      ? new PostgresTaskRepository(config.database.postgres)
      : new SqliteTaskRepository(config.database.sqliteFile);

    await repository.init();
    return repository;
  }
}

class SqliteTaskRepository {
  constructor(sqliteFile) {
    this.sqliteFile = sqliteFile;
    this.database = null;
  }

  async init() {
    await fs.mkdir(path.dirname(this.sqliteFile), { recursive: true });
    this.database = new DatabaseSync(this.sqliteFile);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('done', 'planned')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    this.seedIfEmpty();
  }

  seedIfEmpty() {
    const count = this.database.prepare('SELECT COUNT(*) AS count FROM tasks').get().count;

    if (count > 0) {
      return;
    }

    const insert = this.database.prepare('INSERT INTO tasks (title, status) VALUES (?, ?)');
    for (const task of initialTasks) {
      insert.run(task.title, task.status);
    }
  }

  async findAll() {
    return this.database
      .prepare('SELECT id, title, status FROM tasks ORDER BY id ASC')
      .all();
  }

  async create(task) {
    const result = this.database
      .prepare('INSERT INTO tasks (title, status) VALUES (?, ?)')
      .run(task.title, task.status);

    return this.database
      .prepare('SELECT id, title, status FROM tasks WHERE id = ?')
      .get(Number(result.lastInsertRowid));
  }

  async close() {
    if (this.database) {
      this.database.close();
    }
  }
}

class PostgresTaskRepository {
  constructor(postgresConfig) {
    this.pool = new Pool({
      host: postgresConfig.host,
      port: postgresConfig.port,
      database: postgresConfig.database,
      user: postgresConfig.user,
      password: postgresConfig.password,
      ssl: postgresConfig.ssl ? { rejectUnauthorized: false } : false,
    });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('done', 'planned')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await this.seedIfEmpty();
  }

  async seedIfEmpty() {
    const result = await this.pool.query('SELECT COUNT(*)::int AS count FROM tasks;');

    if (result.rows[0].count > 0) {
      return;
    }

    for (const task of initialTasks) {
      await this.pool.query(
        'INSERT INTO tasks (title, status) VALUES ($1, $2);',
        [task.title, task.status]
      );
    }
  }

  async findAll() {
    const result = await this.pool.query('SELECT id, title, status FROM tasks ORDER BY id ASC;');
    return result.rows;
  }

  async create(task) {
    const result = await this.pool.query(
      'INSERT INTO tasks (title, status) VALUES ($1, $2) RETURNING id, title, status;',
      [task.title, task.status]
    );
    return result.rows[0];
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = TaskRepository;
