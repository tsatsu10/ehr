#!/usr/bin/env node
/**
 * New Clinic i18n string extraction (GAP-D / D1).
 *
 * Statically scans frontend/src for `t('…')` / `t("…")` calls and maintains
 * the translation key inventory. Keys are the English source strings
 * themselves (the core xl() model), so the inventory is simply the sorted
 * set of extracted literals.
 *
 * Outputs (both under the module's hand-managed public/assets/i18n/ —
 * NOT assets/modern/, which `vite build` wipes via emptyOutDir):
 *   messages.json      — canonical key inventory: { "<English>": "" }
 *   <locale>.json      — per-locale dictionary, merged with --locale
 *
 * Usage:
 *   node scripts/extract-i18n.mjs             # rewrite messages.json
 *   node scripts/extract-i18n.mjs --check     # exit 1 if messages.json is stale
 *   node scripts/extract-i18n.mjs --locale fr # merge new keys into fr.json,
 *                                             # keep existing translations,
 *                                             # drop keys no longer in source
 *
 * Rules enforced here (build fails on violation):
 *   - t() must receive a plain string literal. Template literals
 *     (t(`…${x}…`)) defeat static extraction — use {param} interpolation:
 *     t('Hello {name}', { name }).
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const srcDir = resolve(here, '../src');
const i18nDir = resolve(
  here,
  '../../interface/modules/custom_modules/oe-module-new-clinic/public/assets/i18n'
);
const inventoryPath = join(i18nDir, 'messages.json');

const args = process.argv.slice(2);
const checkMode = args.includes('--check');
const localeIndex = args.indexOf('--locale');
const locale = localeIndex !== -1 ? (args[localeIndex + 1] ?? '') : '';

if (localeIndex !== -1 && !/^[a-z]{2}$/.test(locale)) {
  console.error('extract-i18n: --locale expects a two-letter code (e.g. --locale fr)');
  process.exit(1);
}

/** Recursively collect source files, skipping tests and declarations. */
function collectFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      out.push(...collectFiles(full));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (/\.test\.(ts|tsx)$/.test(entry.name)) continue;
    if (/\.d\.ts$/.test(entry.name)) continue;
    if (entry.name === 'test-setup.ts') continue;
    out.push(full);
  }
  return out;
}

/** Unescape the escape sequences valid inside a JS string literal that we care about. */
function unescapeLiteral(raw) {
  return raw.replace(/\\(['"\\nrt`])/g, (_, ch) => {
    if (ch === 'n') return ' '; // keys are single-line, like xl()
    if (ch === 'r') return '';
    if (ch === 't') return ' ';
    return ch;
  });
}

// Bare t( — not foo.t(, not $t(, not part of an identifier (split(, format(…).
const T_CALL = /(?<![\w.$])t\(\s*(['"])((?:\\.|(?!\1).)*)\1/g;
const T_TEMPLATE = /(?<![\w.$])t\(\s*`/g;

/**
 * Strip comments so docblock examples (`t('…')` in the i18n.ts header) don't
 * pollute the inventory. Block comments are removed wholesale; line comments
 * only when the line starts with them (so `'https://…'` in code survives).
 */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const keys = new Set();
const templateViolations = [];

for (const file of collectFiles(srcDir)) {
  const text = stripComments(readFileSync(file, 'utf8'));
  for (const match of text.matchAll(T_CALL)) {
    const key = unescapeLiteral(match[2]).trim();
    if (key !== '') keys.add(key);
  }
  for (const match of text.matchAll(T_TEMPLATE)) {
    const line = text.slice(0, match.index).split('\n').length;
    templateViolations.push(`${file}:${line}`);
  }
}

if (templateViolations.length > 0) {
  console.error(
    'extract-i18n: t() must take a string literal, not a template literal.\n' +
      'Use {param} interpolation instead: t(\'Hello {name}\', { name }).\n' +
      templateViolations.map((loc) => `  ${loc}`).join('\n')
  );
  process.exit(1);
}

const sortedKeys = [...keys].sort((a, b) => a.localeCompare(b, 'en'));
const inventory = Object.fromEntries(sortedKeys.map((key) => [key, '']));
const inventoryJson = `${JSON.stringify(inventory, null, 2)}\n`;

if (checkMode) {
  const existing = existsSync(inventoryPath) ? readFileSync(inventoryPath, 'utf8') : null;
  if (existing !== inventoryJson) {
    console.error(
      'extract-i18n: public/assets/i18n/messages.json is stale.\n' +
        'Run `npm run i18n:extract` (frontend/) and commit the result.'
    );
    process.exit(1);
  }
  console.log(`extract-i18n: inventory up to date (${sortedKeys.length} keys).`);
  process.exit(0);
}

mkdirSync(i18nDir, { recursive: true });
writeFileSync(inventoryPath, inventoryJson, 'utf8');
console.log(`extract-i18n: wrote ${sortedKeys.length} keys to messages.json`);

if (locale !== '') {
  const localePath = join(i18nDir, `${locale}.json`);
  let existing = {};
  if (existsSync(localePath)) {
    try {
      existing = JSON.parse(readFileSync(localePath, 'utf8'));
    } catch {
      console.error(`extract-i18n: ${locale}.json is not valid JSON — fix it first.`);
      process.exit(1);
    }
  }
  let added = 0;
  let dropped = 0;
  const merged = {};
  for (const key of sortedKeys) {
    if (Object.prototype.hasOwnProperty.call(existing, key)) {
      merged[key] = String(existing[key]);
    } else {
      merged[key] = '';
      added += 1;
    }
  }
  for (const key of Object.keys(existing)) {
    if (!keys.has(key)) dropped += 1;
  }
  writeFileSync(localePath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  const untranslated = Object.values(merged).filter((v) => v === '').length;
  console.log(
    `extract-i18n: ${locale}.json merged — +${added} new, -${dropped} orphaned, ` +
      `${untranslated} untranslated (empty = English fallback at runtime).`
  );
}
