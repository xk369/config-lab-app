const express = require('express');
const crypto = require('node:crypto');
const { toPublicConfig } = require('../config');

function createApiRouter({ taskService, config, sessionStore }) {
  const router = express.Router();

  router.get('/health', (request, response) => {
    response.json({
      status: 'ok',
      app: config.appName,
      env: config.env,
      releaseVersion: config.releaseVersion,
      instanceId: config.instanceId,
      requestId: request.requestId,
    });
  });

  router.get('/config', (request, response) => {
    response.json(toPublicConfig(config));
  });

  router.get('/tasks', async (request, response, next) => {
    try {
      const tasks = await taskService.listTasks();
      response.json(tasks);
    } catch (error) {
      next(error);
    }
  });

  router.get('/session', async (request, response, next) => {
    try {
      const sessionId = getSessionId(request, response);
      const counter = await sessionStore.incrementCounter(sessionId);

      response.json({
        sessionId,
        counter,
        store: config.sessions.store,
        instanceId: config.instanceId,
        requestId: request.requestId,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/slow', async (request, response, next) => {
    try {
      const requestedDelay = Number(request.query.ms || 2000);
      const delayMs = Math.min(Math.max(requestedDelay, 1), 10000);

      await delay(delayMs);
      response.json({
        status: 'completed',
        delayMs,
        instanceId: config.instanceId,
        requestId: request.requestId,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/tasks', async (request, response, next) => {
    try {
      const task = await taskService.createTask(request.body);
      response.status(201).json(task);
    } catch (error) {
      next(error);
    }
  });

  router.get('/summary', async (request, response, next) => {
    try {
      const summary = await taskService.getSummary();
      response.json(summary);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function getSessionId(request, response) {
  const cookies = parseCookies(request.headers.cookie || '');

  if (cookies.sid) {
    return cookies.sid;
  }

  const sessionId = crypto.randomUUID();
  response.setHeader('Set-Cookie', [
    `sid=${sessionId}; Path=/; HttpOnly; SameSite=Lax`,
  ]);
  return sessionId;
}

function parseCookies(cookieHeader) {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf('=');

      if (separatorIndex === -1) {
        return cookies;
      }

      const key = part.slice(0, separatorIndex);
      const value = part.slice(separatorIndex + 1);
      cookies[key] = value;
      return cookies;
    }, {});
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

module.exports = createApiRouter;
