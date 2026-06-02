const { DatabaseSync } = require('node:sqlite');
const { Pool } = require('pg');

async function createAdminUser(config, user) {
  if (config.database.client === 'postgres') {
    return createPostgresAdmin(config.database.postgres, user);
  }

  return createSqliteAdmin(config.database.sqliteFile, user);
}

function createSqliteAdmin(sqliteFile, user) {
  const database = new DatabaseSync(sqliteFile);

  try {
    database
      .prepare('INSERT OR IGNORE INTO admin_users (email, role) VALUES (?, ?)')
      .run(user.email, user.role);
    database
      .prepare('UPDATE admin_users SET role = ? WHERE email = ?')
      .run(user.role, user.email);

    return database
      .prepare('SELECT id, email, role FROM admin_users WHERE email = ?')
      .get(user.email);
  } finally {
    database.close();
  }
}

async function createPostgresAdmin(postgresConfig, user) {
  const pool = new Pool({
    host: postgresConfig.host,
    port: postgresConfig.port,
    database: postgresConfig.database,
    user: postgresConfig.user,
    password: postgresConfig.password,
    ssl: postgresConfig.ssl ? { rejectUnauthorized: false } : false,
  });

  try {
    const result = await pool.query(
      `
        INSERT INTO admin_users (email, role)
        VALUES ($1, $2)
        ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
        RETURNING id, email, role;
      `,
      [user.email, user.role]
    );

    return result.rows[0];
  } finally {
    await pool.end();
  }
}

module.exports = {
  createAdminUser,
};
