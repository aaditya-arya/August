const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const release = require('../public/downloads/android-release.json');

test('the public Android download matches its release metadata and native version', () => {
  const directory = path.resolve(__dirname, '../public/downloads');
  const apkPath = path.resolve(__dirname, '../public', '.' + release.path);
  assert.equal(path.dirname(apkPath), directory);
  const apk = fs.readFileSync(apkPath);
  assert.equal(apk.readUInt32LE(0), 0x04034b50);
  assert.equal(apk.length, release.bytes);
  assert.equal(createHash('sha256').update(apk).digest('hex'), release.sha256);
  assert.equal(release.channel, 'preview');
  assert.equal(release.applicationId, 'app.august.nativejournal.debug');
  const gradle = fs.readFileSync(path.resolve(__dirname, '../apps/android/app/build.gradle.kts'), 'utf8');
  assert.equal(/versionName\s*=\s*"([^"]+)"/.exec(gradle)[1], release.version);
  assert.equal(Number(/versionCode\s*=\s*(\d+)/.exec(gradle)[1]), release.versionCode);
});
