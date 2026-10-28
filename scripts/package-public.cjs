const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const env = {
  ...process.env,
  VITE_XTREAM_URL: ' ',
  VITE_XTREAM_USERNAME: ' ',
  VITE_XTREAM_PASSWORD: ' '
};
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function run(args) {
  const result = spawnSync(pnpm, args, { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Public package command failed (${result.status}).`);
}

function localTestValues() {
  const file = path.join(root, '.env.local');
  if (!fs.existsSync(file)) return [];
  const names = new Set(['VITE_XTREAM_URL', 'VITE_XTREAM_USERNAME', 'VITE_XTREAM_PASSWORD']);
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).map((line) => {
    const match = line.match(/^\s*(VITE_XTREAM_(?:URL|USERNAME|PASSWORD))\s*=\s*(.*)\s*$/);
    if (!match || !names.has(match[1])) return '';
    const value = match[2].trim();
    return value.replace(/^(['"])(.*)\1$/, '$2');
  }).filter((value) => value.length >= 4);
}

function verifyPublicBuild() {
  const dist = path.join(root, 'dist');
  const files = [path.join(dist, 'index.html'), path.join(dist, 'assets', 'app.js')];
  const output = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  const embedded = localTestValues().some((secret) => output.includes(secret));
  if (embedded) throw new Error('Build contains local test-provider values. Refusing to create a public IPK.');
  const expectedVersion = JSON.parse(fs.readFileSync(path.join(root, 'public', 'appinfo.json'), 'utf8')).version;
  const packagedVersion = JSON.parse(fs.readFileSync(path.join(dist, 'appinfo.json'), 'utf8')).version;
  if (expectedVersion !== packagedVersion) throw new Error('Package metadata version does not match the public app version.');
}

try {
  run(['build']);
  verifyPublicBuild();
  run(['exec', 'ares-package', 'dist', '-o', 'packages']);
  process.stdout.write('Public IPK created without embedded local provider settings.\n');
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Public packaging failed.'}\n`);
  process.exitCode = 1;
}
