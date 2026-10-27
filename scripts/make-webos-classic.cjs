const fs = require('node:fs');
const path = require('node:path');

const indexPath = path.resolve(__dirname, '..', 'dist', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
const moduleScript = html.match(/<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"[^>]*><\/script>/i);

if (!moduleScript) {
  throw new Error('Could not find Vite’s built application module in dist/index.html.');
}

const classicScript = moduleScript[0]
  .replace(/\s+type="module"/i, '')
  .replace(/\s+crossorigin(?:="[^"]*")?/i, '')
  .replace('<script', '<script defer');

html = html.replace(moduleScript[0], classicScript);
fs.writeFileSync(indexPath, html);
