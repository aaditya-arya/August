const { test } = require('node:test');
const assert = require('node:assert/strict');
const { posix } = require('node:path');
const lock = require('../package-lock.json');

// npm on one OS can leave transitive dependencies of another platform's optional
// packages out of the lockfile. EAS's Linux npm ci then rejects the entire tree.
test('lockfile includes required transitive dependencies on every platform', () => {
  const missing = [];
  for (const [location, entry] of Object.entries(lock.packages)) {
    // Include peer edges of platform runtimes; these are easy to prune on another
    // OS. UI integrations can have peers supplied only when that UI is used.
    const requiredPeers = entry.optional || entry.os || entry.cpu
      ? Object.keys(entry.peerDependencies || {}).filter(name => !entry.peerDependenciesMeta?.[name]?.optional)
      : [];
    for (const name of new Set([...Object.keys(entry.dependencies || {}), ...requiredPeers])) {
      let directory = location;
      let found = false;
      while (true) {
        if (lock.packages[posix.join(directory, 'node_modules', name)]) { found = true; break; }
        if (!directory || directory === '.') break;
        directory = posix.dirname(directory);
        if (directory === '.') directory = '';
      }
      if (!found) missing.push(`${location || '<root>'} needs ${name}`);
    }
  }
  assert.deepEqual(missing, [], `Missing lockfile entries:\n${missing.join('\n')}`);
});
