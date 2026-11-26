const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const root = path.join(__dirname, '..');
const outputs = path.join(root, 'apps/android/app/build/outputs/apk/debug');
const metadataPath = path.join(outputs, 'output-metadata.json');
if (!fs.existsSync(metadataPath)) throw new Error('Build the APK first with npm run build:android.');
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const artifact = metadata.elements?.[0];
const gradle = fs.readFileSync(path.join(root, 'apps/android/app/build.gradle.kts'), 'utf8');
const versionName = /versionName\s*=\s*"([^"]+)"/.exec(gradle)?.[1];
const versionCode = Number(/versionCode\s*=\s*(\d+)/.exec(gradle)?.[1]);
if (!artifact || artifact.versionName !== versionName || artifact.versionCode !== versionCode || metadata.applicationId !== 'app.august.nativejournal.debug') {
  throw new Error('The built APK does not match the current preview version. Run npm run build:android.');
}
const source = path.join(outputs, path.basename(artifact.outputFile));
const bytes = fs.readFileSync(source);
if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('The APK is not a valid ZIP-based package.');
const directory = path.join(root, 'public/downloads');
fs.mkdirSync(directory, { recursive: true });
fs.copyFileSync(source, path.join(directory, 'august-android-preview.apk'));
const release = {
  version: artifact.versionName,
  versionCode: artifact.versionCode,
  channel: 'preview',
  applicationId: metadata.applicationId,
  minimumAndroid: '8.0',
  path: '/downloads/august-android-preview.apk',
  filename: `August-Android-v${artifact.versionName}-preview.apk`,
  bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
};
fs.writeFileSync(path.join(directory, 'android-release.json'), JSON.stringify(release, null, 2) + '\n');
console.log(`Packaged August Android ${release.version} preview (${(release.bytes / 1e6).toFixed(1)} MB) for website download.`);
