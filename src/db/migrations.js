const fs = require('node:fs/promises');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { Pool } = require('pg');

const migrations = [
  {
    id: '001_create_tasks',
    sqlite: `
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('done', 'planned')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('done', 'planned')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
  },
  {
    id: '002_create_admin_users',
    sqlite: `
      CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL DEFAULT 'admin',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL DEFAULT 'admin',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
  },
];

async function runMigrations(config, logger = null) {
  if (config.database.client === 'postgres') {
    return runPostgresMigrations(config.database.postgres, logger);
  }

  return runSqliteMigrations(config.database.sqliteFile, logger);
}

async function runSqliteMigrations(sqliteFile, logger) {
  await fs.mkdir(path.dirname(sqliteFile), { recursive: true });
  const database = new DatabaseSync(sqliteFile);
  const applied = [];
  const skipped = [];

  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    for (const migration of migrations) {
      let transactionStarted = false;
      const exists = database
        .prepare('SELECT id FROM schema_migrations WHERE id = ?')
        .get(migration.id);

      if (exists) {
        skipped.push(migration.id);
        continue;
      }

      try {
        database.exec('BEGIN');
        transactionStarted = true;
        database.exec(migration.sqlite);
        database
          .prepare('INSERT INTO schema_migrations (id) VALUES (?)')
          .run(migration.id);
        database.exec('COMMIT');
      } catch (error) {
        if (transactionStarted) {
          database.exec('ROLLBACK');
        }
        throw error;
      }
      applied.push(migration.id);
      logger?.info('migration.applied', { migration: migration.id, databaseClient: 'sqlite' });
    }
  } finally {
    database.close();
  }

  return { applied, skipped };
}

async function runPostgresMigrations(postgresConfig, logger) {
  const pool = new Pool({
    host: postgresConfig.host,
    port: postgresConfig.port,
    database: postgresConfig.database,
    user: postgresConfig.user,
    password: postgresConfig.password,
    ssl: postgresConfig.ssl ? { rejectUnauthorized: false } : false,
  });
  const applied = [];
  const skipped = [];

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    for (const migration of migrations) {
      const exists = await pool.query(
        'SELECT id FROM schema_migrations WHERE id = $1;',
        [migration.id]
      );

      if (exists.rowCount > 0) {
        skipped.push(migration.id);
        continue;
      }

      await pool.query('BEGIN');
      await pool.query(migration.postgres);
      await pool.query('INSERT INTO schema_migrations (id) VALUES ($1);', [migration.id]);
      await pool.query('COMMIT');
      applied.push(migration.id);
      logger?.info('migration.applied', { migration: migration.id, databaseClient: 'postgres' });
    }
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await pool.end();
  }

  return { applied, skipped };
}

module.exports = {
  migrations,
  runMigrations,
};
