// scripts/generate-version.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const buildId = Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
const versionData = {
  buildId,
  builtAt: new Date().toISOString(),
  version: "1.0." + Date.now().toString().slice(-4)
};

const targetDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const targetPath = path.join(targetDir, 'version.json');
fs.writeFileSync(targetPath, JSON.stringify(versionData, null, 2), 'utf-8');

console.log(`[build-version] Generated version.json -> buildId: ${buildId}`);
