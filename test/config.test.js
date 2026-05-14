const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('configuration reads runtime values from environment-friendly defaults', () => {
  const config = require('../src/config');

  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.port, 3001);
  assert.equal(path.isAbsolute(config.dataFile), true);
});

test('source files do not contain hardcoded local user paths', () => {
  const projectRoot = path.join(__dirname, '..');
  const forbiddenPathPatterns = [
    `/${'Users'}/`,
    `/${'home'}/`,
    `C:\\${'Users'}\\`,
  ];
  const ignoredDirectories = new Set(['.git', 'node_modules', 'data', 'reports']);
  const filesToCheck = [];

  function collectFiles(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) {
          collectFiles(path.join(directory, entry.name));
        }
        continue;
      }

      filesToCheck.push(path.join(directory, entry.name));
    }
  }

  collectFiles(projectRoot);

  for (const filePath of filesToCheck) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const pattern of forbiddenPathPatterns) {
      assert.equal(
        content.includes(pattern),
        false,
        `${path.relative(projectRoot, filePath)} contains forbidden local path pattern ${pattern}`
      );
    }
  }
});
