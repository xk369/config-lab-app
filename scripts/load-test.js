const http = require('node:http');
const https = require('node:https');

async function main() {
  const target = process.argv[2] || 'http://localhost:8080/api/session';
  const requestCount = Number(process.argv[3] || 30);
  const summary = await runLoadTest(target, requestCount);

  console.log(JSON.stringify(summary, null, 2));
}

async function runLoadTest(target, requestCount) {
  let cookie = '';
  const hitsByInstance = {};
  const counters = [];

  for (let index = 0; index < requestCount; index += 1) {
    const response = await requestJson(target, cookie);

    if (!cookie && response.headers['set-cookie']) {
      cookie = response.headers['set-cookie'][0].split(';')[0];
    }

    const instanceId = response.body.instanceId || 'unknown';
    hitsByInstance[instanceId] = (hitsByInstance[instanceId] || 0) + 1;
    counters.push(response.body.counter);
  }

  return {
    target,
    requestCount,
    sessionCookie: cookie ? 'preserved' : 'not-set',
    uniqueInstances: Object.keys(hitsByInstance).length,
    hitsByInstance,
    lastSessionCounter: counters.at(-1),
  };
}

function requestJson(target, cookie) {
  const url = new URL(target);
  const client = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const request = client.request(
      url,
      {
        method: 'GET',
        headers: cookie ? { Cookie: cookie } : {},
      },
      (response) => {
        const chunks = [];

        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          try {
            resolve({
              headers: response.headers,
              body: JSON.parse(Buffer.concat(chunks).toString()),
            });
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on('error', reject);
    request.end();
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  runLoadTest,
};
