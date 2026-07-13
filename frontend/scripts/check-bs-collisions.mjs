#!/usr/bin/env node
/**
 * GAP-D / D6 — Bootstrap-collision ratchet guard.
 *
 * Bootstrap 4 (bundled UNLAYERED with `!important` in core's style_light.css,
 * loaded on every OpenEMR page via Header::setupHeader) defines utility classes
 * whose NAMES collide with Tailwind's — `bg-white`, `border`, `rounded*`,
 * `text-white`, `text-center`, … . When an island control's *state* styling uses
 * a colliding class, BS4's `!important` silently freezes it (the Admin Hub
 * "read-only checkboxes" incident: the checkbox toggled state correctly but
 * painted identically). See the memory note `bootstrap-tailwind-class-name-collisions`
 * and CLAUDE.md §6.
 *
 * De-Bootstrapping is a wide, incremental sweep that must be paired with per-desk
 * visual QA (dropping the theme stylesheet changes pixels). This guard does NOT
 * try to do that sweep — it PINS the current usage per class in
 * `bs-collision-baseline.json` and fails if any count INCREASES, so the set can
 * only shrink. Lower a baseline number (never raise it) as you migrate a class to
 * a token-based arbitrary value (`bg-[var(--oe-nc-surface)]`) or an `nc-` BEM rule.
 *
 * Usage:
 *   node scripts/check-bs-collisions.mjs            # ratchet check (CI/gate)
 *   node scripts/check-bs-collisions.mjs --write    # regenerate the baseline
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const srcDir = resolve(here, '../src');
const baselinePath = resolve(here, 'bs-collision-baseline.json');
const write = process.argv.includes('--write');

/**
 * BS4 `!important` utility classes that share a name with a Tailwind utility.
 * Word-boundary matched inside className/clsx/cn string literals. Bootstrap
 * classes whose names do NOT collide with Tailwind (`d-none`, `justify-content-*`,
 * `w-100`, `font-weight-*`) are intentionally excluded — they can't be frozen by
 * a Tailwind name clash.
 */
const CLASSES = [
  'bg-white', 'bg-transparent', 'bg-primary', 'bg-secondary', 'bg-success',
  'bg-danger', 'bg-warning', 'bg-info', 'bg-light', 'bg-dark',
  'border', 'border-0', 'rounded', 'rounded-sm', 'rounded-lg', 'rounded-circle',
  'text-white', 'text-center', 'text-left', 'text-right', 'text-nowrap',
  'text-truncate',
];

/**
 * Genuinely BS4-ONLY utility classes — no Tailwind class of the same name, so
 * they VANISH when the core theme stylesheet is dropped (D6 Step 3 cutover).
 * The frontend was found already free of these (2026-07-12), so this set is
 * held at ZERO: any new one is a cutover regression. (`sr-only`, `flex-wrap`,
 * `mx-auto`, `text-right`, … exist in Tailwind too, so they're NOT here.)
 * Replace with the Tailwind equivalent: d-flex→flex, d-inline-block→inline-block,
 * h-100→h-full, justify-content-center→justify-center, font-weight-bold→font-bold.
 */
const BS4_ONLY = [
  'd-none', 'd-block', 'd-inline', 'd-inline-block', 'd-flex', 'd-inline-flex',
  'd-table', 'd-grid',
  'justify-content-start', 'justify-content-end', 'justify-content-center',
  'justify-content-between', 'justify-content-around',
  'align-items-start', 'align-items-end', 'align-items-center',
  'w-25', 'w-50', 'w-75', 'w-100', 'h-25', 'h-50', 'h-75', 'h-100', 'mw-100', 'mh-100',
  'font-weight-bold', 'font-weight-normal', 'font-weight-light', 'font-weight-bolder',
  'text-uppercase', 'text-lowercase', 'text-capitalize', 'text-monospace', 'text-justify',
  'float-left', 'float-right', 'float-none',
];

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
    out.push(full);
  }
  return out;
}

// Count class occurrences only inside string literals (className, clsx, cn, cva).
// A className token is delimited by whitespace or a quote; we match the class as a
// whole token so `border` does not match `border-t-2` / `nc-border`.
function countInText(text, cls) {
  const re = new RegExp(`(?<![\\w-])${cls.replace(/[-]/g, '\\-')}(?![\\w-])`, 'g');
  let count = 0;
  // Only look inside single/double/backtick string literals to avoid identifiers.
  const strings = text.match(/(['"`])(?:\\.|(?!\1)[\s\S])*?\1/g) ?? [];
  for (const s of strings) {
    const m = s.match(re);
    if (m) count += m.length;
  }
  return count;
}

const counts = {};
for (const cls of CLASSES) counts[cls] = 0;
const bs4OnlyHits = [];
for (const file of collectFiles(srcDir)) {
  const text = readFileSync(file, 'utf8');
  for (const cls of CLASSES) counts[cls] += countInText(text, cls);
  for (const cls of BS4_ONLY) {
    if (countInText(text, cls) > 0) bs4OnlyHits.push(`  ${cls}  (${file.replace(srcDir, 'src')})`);
  }
}
const current = Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 0));
const total = Object.values(current).reduce((a, b) => a + b, 0);

if (write) {
  writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
  console.log(`check-bs-collisions: baseline written — ${total} colliding usages across ${Object.keys(current).length} classes.`);
  process.exit(0);
}

// Zero-tolerance: BS4-only classes break the D6 cutover — none allowed.
if (bs4OnlyHits.length > 0) {
  console.error(
    'check-bs-collisions: BS4-only class(es) found — these vanish when the theme stylesheet is\n' +
      'dropped (D6 cutover). Use the Tailwind equivalent (d-flex→flex, h-100→h-full, …):\n' +
      bs4OnlyHits.join('\n')
  );
  process.exit(1);
}

if (!existsSync(baselinePath)) {
  console.error('check-bs-collisions: no baseline. Run `node scripts/check-bs-collisions.mjs --write` first.');
  process.exit(1);
}
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));

const regressions = [];
for (const [cls, n] of Object.entries(current)) {
  const allowed = baseline[cls] ?? 0;
  if (n > allowed) regressions.push(`  ${cls}: ${n} > baseline ${allowed}`);
}
if (regressions.length > 0) {
  console.error(
    'check-bs-collisions: Bootstrap-colliding class usage INCREASED (D6 ratchet).\n' +
      'Use a token arbitrary value (bg-[var(--oe-nc-surface)]) or an nc- BEM rule instead.\n' +
      regressions.join('\n')
  );
  process.exit(1);
}

const baselineTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
console.log(
  `check-bs-collisions: OK — ${total} colliding usages (baseline ${baselineTotal}).` +
    (total < baselineTotal ? ` ↓${baselineTotal - total} — lower the baseline to lock it in.` : '')
);
