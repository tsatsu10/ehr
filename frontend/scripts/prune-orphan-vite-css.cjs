/**
 * Delete hashed main-*.css files not referenced by the Vite manifest.
 * Usage: node frontend/scripts/prune-orphan-vite-css.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const manifestPath = path.join(
  root,
  'interface/modules/custom_modules/oe-module-new-clinic/public/assets/modern/.vite/manifest.json',
);
const assetsDir = path.join(
  root,
  'interface/modules/custom_modules/oe-module-new-clinic/public/assets/modern/assets',
);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const keep = new Set();

for (const entry of Object.values(manifest)) {
  if (entry.file && entry.file.startsWith('assets/main-') && entry.file.endsWith('.css')) {
    keep.add(path.basename(entry.file));
  }
  if (Array.isArray(entry.css)) {
    for (const css of entry.css) {
      if (css.startsWith('assets/main-') && css.endsWith('.css')) {
        keep.add(path.basename(css));
      }
    }
  }
}

let removed = 0;
for (const file of fs.readdirSync(assetsDir)) {
  if (!/^main-.+\.css$/.test(file)) {
    continue;
  }
  if (keep.has(file)) {
    continue;
  }
  fs.unlinkSync(path.join(assetsDir, file));
  removed += 1;
  console.log('removed', file);
}

console.log(`kept ${keep.size} main-*.css, removed ${removed} orphans`);
