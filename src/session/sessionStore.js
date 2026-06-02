const net = require('node:net');

class MemorySessionStore {
  constructor() {
    this.sessions = new Map();
  }

  async incrementCounter(sessionId) {
    const key = `session:${sessionId}:counter`;
    const nextValue = (this.sessions.get(key) || 0) + 1;
    this.sessions.set(key, nextValue);
    return nextValue;
  }

  async clear() {
    const count = this.sessions.size;
    this.sessions.clear();
    return { cleared: count };
  }

  async close() {}
}

class RedisSessionStore {
  constructor(redisUrl) {
    this.redisUrl = redisUrl;
  }

  async incrementCounter(sessionId) {
    const key = `session:${sessionId}:counter`;
    const count = await sendRedisCommand(this.redisUrl, ['INCR', key]);
    await sendRedisCommand(this.redisUrl, ['EXPIRE', key, '86400']);
    return Number(count);
  }

  async clear() {
    await sendRedisCommand(this.redisUrl, ['FLUSHDB']);
    return { cleared: 'redis-db' };
  }

  async close() {}
}

async function createSessionStore(config, logger) {
  if (config.sessions.store === 'redis') {
    logger.info('session.store.enabled', {
      store: 'redis',
      redisUrl: sanitizeRedisUrl(config.sessions.redisUrl),
    });
    return new RedisSessionStore(config.sessions.redisUrl);
  }

  logger.info('session.store.enabled', { store: 'memory' });
  return new MemorySessionStore();
}

function sanitizeRedisUrl(redisUrl) {
  const parsedUrl = new URL(redisUrl);
  parsedUrl.password = parsedUrl.password ? '***' : '';
  return parsedUrl.toString();
}

function serializeCommand(args) {
  const parts = [`*${args.length}`];

  for (const arg of args) {
    const value = String(arg);
    parts.push(`$${Buffer.byteLength(value)}`, value);
  }

  return `${parts.join('\r\n')}\r\n`;
}

async function sendRedisCommand(redisUrl, args) {
  const parsedUrl = new URL(redisUrl);
  const host = parsedUrl.hostname;
  const port = Number(parsedUrl.port || 6379);

  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const chunks = [];
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('Redis command timed out.'));
    }, 5000);

    socket.on('connect', () => {
      socket.write(serializeCommand(args));
    });

    socket.on('data', (chunk) => {
      chunks.push(chunk);
      let parsed;

      try {
        parsed = parseResp(Buffer.concat(chunks));
      } catch (error) {
        clearTimeout(timeout);
        socket.destroy();
        reject(error);
        return;
      }

      if (!parsed) {
        return;
      }

      clearTimeout(timeout);
      socket.end();
      resolve(parsed.value);
    });

    socket.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function parseResp(buffer) {
  if (buffer.length === 0) {
    return null;
  }

  const prefix = String.fromCharCode(buffer[0]);
  const lineEnd = buffer.indexOf('\r\n');

  if (lineEnd === -1) {
    return null;
  }

  const line = buffer.subarray(1, lineEnd).toString();

  if (prefix === '+') {
    return { value: line };
  }

  if (prefix === ':') {
    return { value: Number(line) };
  }

  if (prefix === '-') {
    throw new Error(`Redis error: ${line}`);
  }

  if (prefix === '$') {
    const length = Number(line);

    if (length === -1) {
      return { value: null };
    }

    const start = lineEnd + 2;
    const end = start + length;

    if (buffer.length < end + 2) {
      return null;
    }

    return { value: buffer.subarray(start, end).toString() };
  }

  throw new Error(`Unsupported Redis response prefix: ${prefix}`);
}

module.exports = {
  createSessionStore,
  MemorySessionStore,
  RedisSessionStore,
};
