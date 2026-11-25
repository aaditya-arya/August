const { networkInterfaces } = require('node:os');
const { spawn } = require('node:child_process');
const { join } = require('node:path');

const addresses = [...new Set(Object.values(networkInterfaces()).flat()
  .filter(entry => entry && entry.family === 'IPv4' && !entry.internal && !entry.address.startsWith('169.254.'))
  .map(entry => entry.address))];
console.log('\nAugust phone connection\n');
for (const address of addresses) console.log(`  Enter this on your phone: http://${address}:3000`);
console.log('\nUse the same Wi-Fi on both devices. 0.0.0.0 is a listening address, not a phone address.');
if (process.platform === 'win32') console.log('If your phone cannot open the address, run scripts/allow-phone-dev.ps1 in Administrator PowerShell.');
console.log('');
const child = spawn(process.execPath, [join(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '--hostname', '0.0.0.0', '--port', '3000'], { stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 0; });
