/**
 * React island bundle smoke tests.
 *
 * Verifies Vite build output is published at the expected URLs so Twig pages
 * can load the bundles when the relevant feature flags are on.
 * Does NOT require a logged-in OpenEMR session — hits static assets via Apache.
 *
 * NOTE: Entry-point JS files are small stubs (< 2 KB) that import from the
 * shared React chunk (chunks/mountIsland-*.js). Size assertions reflect this.
 *
 * @group e2e
 * @group new-clinic-frontend
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost/openemr';
const ASSET_BASE =
  BASE_URL.replace(/\/$/, '') +
  '/interface/modules/custom_modules/oe-module-new-clinic/public/assets/modern';

test.describe('React island bundle assets', () => {

  // ── visit-board ───────────────────────────────────────────────────────────

  test('visit-board.js entry is served by Apache', async ({ request }) => {
    const response = await request.get(`${ASSET_BASE}/visit-board.js`);
    expect(response.status(), 'visit-board bundle should be reachable').toBe(200);

    const body = await response.text();
    expect(body.length, 'bundle should not be empty').toBeGreaterThan(50);
  });

  test('visit-board.css is served by Apache', async ({ request }) => {
    const response = await request.get(`${ASSET_BASE}/visit-board.css`);
    expect(response.status(), 'visit-board CSS should be reachable').toBe(200);

    const body = await response.text();
    expect(body.length, 'CSS should not be empty').toBeGreaterThan(100);
    // Must contain the island-specific non-layered BEM rules
    expect(body, 'CSS should contain nc-vb column styles').toContain('nc-vb-column');
  });

  // ── Phase 2A — triage-desk ────────────────────────────────────────────────

  test('triage-desk.js entry is served by Apache', async ({ request }) => {
    const response = await request.get(`${ASSET_BASE}/triage-desk.js`);
    expect(response.status(), 'triage-desk bundle should be reachable').toBe(200);

    const body = await response.text();
    expect(body.length, 'bundle should not be empty').toBeGreaterThan(50);
  });

  test('triage-desk.css is served by Apache', async ({ request }) => {
    const response = await request.get(`${ASSET_BASE}/triage-desk.css`);
    expect(response.status(), 'triage-desk CSS should be reachable').toBe(200);

    const body = await response.text();
    expect(body.length, 'CSS should not be empty').toBeGreaterThan(100);
    expect(body, 'CSS should contain triage queue panel styles').toContain('nc-triage-queue-panel');
  });

  // ── Phase 3A — doctor-desk ────────────────────────────────────────────────

  test('doctor-desk.js entry is served by Apache', async ({ request }) => {
    const response = await request.get(`${ASSET_BASE}/doctor-desk.js`);
    expect(response.status(), 'doctor-desk bundle should be reachable').toBe(200);

    const body = await response.text();
    expect(body.length, 'bundle should not be empty').toBeGreaterThan(50);
  });

  test('doctor-desk.css is served by Apache', async ({ request }) => {
    const response = await request.get(`${ASSET_BASE}/doctor-desk.css`);
    expect(response.status(), 'doctor-desk CSS should be reachable').toBe(200);

    const body = await response.text();
    expect(body.length, 'CSS should not be empty').toBeGreaterThan(100);
    expect(body, 'CSS should contain doctor queue panel styles').toContain('nc-doctor-queue-panel');
  });

  // ── Phase 4A — cashier-desk ───────────────────────────────────────────────

  test('cashier-desk.js entry is served by Apache', async ({ request }) => {
    const response = await request.get(`${ASSET_BASE}/cashier-desk.js`);
    expect(response.status(), 'cashier-desk bundle should be reachable').toBe(200);

    const body = await response.text();
    expect(body.length, 'bundle should not be empty').toBeGreaterThan(50);
  });

  test('cashier-desk.css is served by Apache', async ({ request }) => {
    const response = await request.get(`${ASSET_BASE}/cashier-desk.css`);
    expect(response.status(), 'cashier-desk CSS should be reachable').toBe(200);

    const body = await response.text();
    expect(body.length, 'CSS should not be empty').toBeGreaterThan(100);
    expect(body, 'CSS should contain cashier queue panel styles').toContain('nc-cashier-queue-panel');
  });

  // ── Phase 5A — lab-desk ───────────────────────────────────────────────────

  test('lab-desk.js entry is served by Apache', async ({ request }) => {
    const response = await request.get(`${ASSET_BASE}/lab-desk.js`);
    expect(response.status(), 'lab-desk bundle should be reachable').toBe(200);

    const body = await response.text();
    expect(body.length, 'bundle should not be empty').toBeGreaterThan(50);
  });

  test('lab-desk.css is served by Apache', async ({ request }) => {
    const response = await request.get(`${ASSET_BASE}/lab-desk.css`);
    expect(response.status(), 'lab-desk CSS should be reachable').toBe(200);

    const body = await response.text();
    expect(body.length, 'CSS should not be empty').toBeGreaterThan(100);
    expect(body, 'CSS should contain lab queue panel styles').toContain('nc-lab-queue-panel');
  });

  // ── Phase 6A — pharmacy-desk ──────────────────────────────────────────────

  test('pharmacy-desk.js entry is served by Apache', async ({ request }) => {
    const response = await request.get(`${ASSET_BASE}/pharmacy-desk.js`);
    expect(response.status(), 'pharmacy-desk bundle should be reachable').toBe(200);

    const body = await response.text();
    expect(body.length, 'bundle should not be empty').toBeGreaterThan(50);
  });

  test('pharmacy-desk.css is served by Apache', async ({ request }) => {
    const response = await request.get(`${ASSET_BASE}/pharmacy-desk.css`);
    expect(response.status(), 'pharmacy-desk CSS should be reachable').toBe(200);

    const body = await response.text();
    expect(body.length, 'CSS should not be empty').toBeGreaterThan(100);
    expect(body, 'CSS should contain pharmacy queue panel styles').toContain('nc-pharmacy-queue-panel');
  });

  // ── Phase 7A — front-desk ─────────────────────────────────────────────────

  test('front-desk.js entry is served by Apache', async ({ request }) => {
    const response = await request.get(`${ASSET_BASE}/front-desk.js`);
    expect(response.status(), 'front-desk bundle should be reachable').toBe(200);

    const body = await response.text();
    expect(body.length, 'bundle should not be empty').toBeGreaterThan(50);
  });

  test('front-desk.css is served by Apache', async ({ request }) => {
    const response = await request.get(`${ASSET_BASE}/front-desk.css`);
    expect(response.status(), 'front-desk CSS should be reachable').toBe(200);

    const body = await response.text();
    expect(body.length, 'CSS should not be empty').toBeGreaterThan(100);
    expect(body, 'CSS should contain front desk search styles').toContain('nc-front-desk-react-active');
  });

  // ── Shared chunk ──────────────────────────────────────────────────────────

  test('shared React chunk (mountIsland) is served by Apache', async ({ request }) => {
    // The manifest tells us the exact hashed filename
    const manifestRes = await request.get(`${ASSET_BASE}/.vite/manifest.json`);
    expect(manifestRes.status()).toBe(200);

    const manifest = await manifestRes.json();
    const boardEntry = manifest['src/islands/visit-board/index.tsx'];
    expect(boardEntry?.imports?.length, 'entry should import at least one chunk').toBeGreaterThan(0);

    // imports[] contains manifest keys, not file paths — look up the entry
    const chunkKey = boardEntry.imports[0];
    const chunkEntry = manifest[chunkKey];
    expect(chunkEntry, 'shared chunk manifest entry should exist').toBeDefined();
    const chunkRes = await request.get(`${ASSET_BASE}/${chunkEntry.file}`);
    expect(chunkRes.status(), 'shared chunk should be reachable').toBe(200);

    const chunkBody = await chunkRes.text();
    // The shared chunk contains React + mountIsland — must be substantial
    expect(chunkBody.length, 'shared chunk should contain React runtime').toBeGreaterThan(50_000);
  });

  // ── Vite manifest ─────────────────────────────────────────────────────────

  test('Vite manifest is published and lists all islands', async ({ request }) => {
    const response = await request.get(`${ASSET_BASE}/.vite/manifest.json`);
    expect(response.status()).toBe(200);

    const manifest = await response.json();

    // visit-board entry
    const boardEntry = manifest['src/islands/visit-board/index.tsx'];
    expect(boardEntry, 'manifest should list visit-board').toBeDefined();
    expect(boardEntry.isEntry, 'isEntry should be true').toBe(true);
    expect(boardEntry.file, 'file should be unhashed entry').toBe('visit-board.js');
    expect(boardEntry.css, 'manifest should list visit-board CSS').toEqual(['visit-board.css']);

    // triage-desk entry
    const triageEntry = manifest['src/islands/triage-desk/index.tsx'];
    expect(triageEntry, 'manifest should list triage-desk').toBeDefined();
    expect(triageEntry.isEntry, 'isEntry should be true').toBe(true);
    expect(triageEntry.file, 'file should be unhashed entry').toBe('triage-desk.js');
    expect(triageEntry.css, 'manifest should list triage-desk CSS').toEqual(['triage-desk.css']);

    // doctor-desk entry
    const doctorEntry = manifest['src/islands/doctor-desk/index.tsx'];
    expect(doctorEntry, 'manifest should list doctor-desk').toBeDefined();
    expect(doctorEntry.isEntry, 'isEntry should be true').toBe(true);
    expect(doctorEntry.file, 'file should be unhashed entry').toBe('doctor-desk.js');
    expect(doctorEntry.css, 'manifest should list doctor-desk CSS').toEqual(['doctor-desk.css']);

    // cashier-desk entry
    const cashierEntry = manifest['src/islands/cashier-desk/index.tsx'];
    expect(cashierEntry, 'manifest should list cashier-desk').toBeDefined();
    expect(cashierEntry.isEntry, 'isEntry should be true').toBe(true);
    expect(cashierEntry.file, 'file should be unhashed entry').toBe('cashier-desk.js');
    expect(cashierEntry.css, 'manifest should list cashier-desk CSS').toEqual(['cashier-desk.css']);

    // lab-desk entry
    const labEntry = manifest['src/islands/lab-desk/index.tsx'];
    expect(labEntry, 'manifest should list lab-desk').toBeDefined();
    expect(labEntry.isEntry, 'isEntry should be true').toBe(true);
    expect(labEntry.file, 'file should be unhashed entry').toBe('lab-desk.js');
    expect(labEntry.css, 'manifest should list lab-desk CSS').toEqual(['lab-desk.css']);

    // pharmacy-desk entry
    const pharmacyEntry = manifest['src/islands/pharmacy-desk/index.tsx'];
    expect(pharmacyEntry, 'manifest should list pharmacy-desk').toBeDefined();
    expect(pharmacyEntry.isEntry, 'isEntry should be true').toBe(true);
    expect(pharmacyEntry.file, 'file should be unhashed entry').toBe('pharmacy-desk.js');
    expect(pharmacyEntry.css, 'manifest should list pharmacy-desk CSS').toEqual(['pharmacy-desk.css']);

    // front-desk entry
    const frontEntry = manifest['src/islands/front-desk/index.tsx'];
    expect(frontEntry, 'manifest should list front-desk').toBeDefined();
    expect(frontEntry.isEntry, 'isEntry should be true').toBe(true);
    expect(frontEntry.file, 'file should be unhashed entry').toBe('front-desk.js');
    expect(frontEntry.css, 'manifest should list front-desk CSS').toEqual(['front-desk.css']);

    const postPilotIslands = [
      ['patient-registry', 'src/islands/patient-registry/index.tsx'],
      ['daily-reports', 'src/islands/daily-reports/index.tsx'],
      ['communications-hub', 'src/islands/communications-hub/index.tsx'],
      ['admin-hub', 'src/islands/admin-hub/index.tsx'],
      ['patient-chart', 'src/islands/patient-chart/index.tsx'],
      ['lab-ops', 'src/islands/lab-ops/index.tsx'],
      ['pharm-ops', 'src/islands/pharm-ops/index.tsx'],
      ['chart-depth', 'src/islands/chart-depth/index.tsx'],
      ['bill-ops', 'src/islands/bill-ops/index.tsx'],
      ['bill-ops-correct', 'src/islands/bill-ops/index-correct.tsx'],
    ];

    for (const [name, key] of postPilotIslands) {
      const entry = manifest[key];
      expect(entry, `manifest should list ${name}`).toBeDefined();
      expect(entry.isEntry, `${name} isEntry should be true`).toBe(true);
      expect(entry.file, `${name} file should be unhashed entry`).toBe(`${name}.js`);
    }
  });

  // ── pharm-ops (M13) ───────────────────────────────────────────────────────

  test('pharm-ops.js entry is served by Apache', async ({ request }) => {
    const response = await request.get(`${ASSET_BASE}/pharm-ops.js`);
    expect(response.status(), 'pharm-ops bundle should be reachable').toBe(200);

    const body = await response.text();
    expect(body.length, 'bundle should not be empty').toBeGreaterThan(50);
  });

  test('pharm-ops CSS (manifest-resolved) is served by Apache', async ({ request }) => {
    // pharm-ops CSS merged into shared chunk css (no fixed pharm-ops.css since
    // the V1.1-slices build); the page resolves its stylesheets from the
    // manifest (PageController island_css), so the spec must do the same.
    const manifestRes = await request.get(`${ASSET_BASE}/.vite/manifest.json`);
    expect(manifestRes.status()).toBe(200);
    const manifest = await manifestRes.json();

    const entry = manifest['src/islands/pharm-ops/index.tsx'];
    expect(entry, 'manifest should list pharm-ops').toBeDefined();

    // Collect css from the entry and its imported chunks (shared css lives there).
    const cssFiles = new Set(entry.css ?? []);
    for (const importKey of entry.imports ?? []) {
      for (const css of manifest[importKey]?.css ?? []) cssFiles.add(css);
    }
    expect(cssFiles.size, 'pharm-ops should resolve at least one stylesheet').toBeGreaterThan(0);

    let combined = '';
    for (const cssFile of cssFiles) {
      const response = await request.get(`${ASSET_BASE}/${cssFile}`);
      expect(response.status(), `${cssFile} should be reachable`).toBe(200);
      combined += await response.text();
    }
    expect(combined.length, 'CSS should not be empty').toBeGreaterThan(100);
    expect(combined, 'CSS should contain pharm ops hub styles').toContain('nc-pharmops');
  });

  test('pharm-ops lazy chunks resolve relative to the entry bundle', async ({ request }) => {
    const entryResponse = await request.get(`${ASSET_BASE}/pharm-ops.js`);
    expect(entryResponse.status()).toBe(200);

    const entryBody = await entryResponse.text();
    const chunkMatch = entryBody.match(/\.\/chunks\/[^"']+\.js/);
    expect(chunkMatch, 'pharm-ops should reference a relative lazy chunk').toBeTruthy();

    const chunkUrl = `${ASSET_BASE}/${chunkMatch[0].replace(/^\.\//, '')}`;
    const chunkResponse = await request.get(chunkUrl);
    expect(chunkResponse.status(), `lazy chunk should load: ${chunkUrl}`).toBe(200);

    const cssMatch = entryBody.match(/\.\/assets\/[^"']+\.css/);
    if (cssMatch) {
      const cssUrl = `${ASSET_BASE}/${cssMatch[0].replace(/^\.\//, '')}`;
      const cssResponse = await request.get(cssUrl);
      expect(cssResponse.status(), `shared chunk CSS should load: ${cssUrl}`).toBe(200);
    }
  });

  test('post-pilot island bundles are served by Apache', async ({ request }) => {
    const islands = [
      'patient-registry',
      'daily-reports',
      'communications-hub',
      'admin-hub',
      'patient-chart',
      'lab-ops',
      'pharm-ops',
      'chart-depth',
      'bill-ops',
      'bill-ops-correct',
    ];

    for (const name of islands) {
      const response = await request.get(`${ASSET_BASE}/${name}.js`);
      expect(response.status(), `${name}.js should be reachable`).toBe(200);
      const body = await response.text();
      expect(body.length, `${name}.js should not be empty`).toBeGreaterThan(50);
    }
  });
});
