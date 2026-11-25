const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

const actions = {
  build: [':app:assembleDebug'],
  install: [':app:installDebug'],
  check: [':app:testDebugUnitTest', ':app:lintDebug'],
  'device-test': [':app:connectedDebugAndroidTest'],
};
const tasks = actions[process.argv[2]];
if (!tasks) { console.error('Choose build, install, check, or device-test.'); process.exit(1); }
const cwd = join(__dirname, '..', 'apps', 'android');
const options = { cwd, stdio: 'inherit', env: process.env };
const result = process.platform === 'win32'
  ? spawnSync('cmd.exe', ['/d', '/c', 'gradlew.bat', ...tasks, '--console=plain'], options)
  : spawnSync('sh', ['./gradlew', ...tasks, '--console=plain'], options);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
