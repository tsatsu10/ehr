/**
 * V1.1-OPS smoke — ops polish bundle (M0-F34/F35, M1a-F13, M5 MoMo, M7-F19, NG15, S1-F09).
 *
 * @group e2e
 * @group new-clinic-v11-ops
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login: loginAsAdmin, login } = require('../helpers/auth');

const ADMIN_USER = process.env.TEST_USERNAME_ADMIN || 'Adminstrator';
const ADMIN_PASS = process.env.TEST_PASSWORD_ADMIN || 'passpass1';
const RECEPTION_USER = process.env.TEST_USERNAME_RECEPTION || 'reception_user';
const RECEPTION_PASS = process.env.TEST_PASSWORD_RECEPTION || 'test_pass';
const CHART_PID = Number(process.env.TEST_CHART_PID || '4');
const SEARCH_NAME = process.env.TEST_CHART_SEARCH_NAME || 'Mavis';

const SCRIPTS_DIR = path.join(
  __dirname,
  '../../../../interface/modules/custom_modules/oe-module-new-clinic/scripts',
);

function runPhpScript(scriptName) {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(SCRIPTS_DIR, scriptName);
  execSync(`"${php}" "${script}"`, { stdio: 'inherit' });
}

function readIslandPollMs(page, islandName) {
  return page.locator(`[data-island="${islandName}"]`).getAttribute('data-props').then((raw) => {
    if (!raw) {
      return null;
    }
    const props = JSON.parse(raw);
    return props.pollMs ?? null;
  });
}

test.describe('V1.1-OPS smoke', () => {
  test.beforeAll(() => {
    runPhpScript('pilot-enable-v11-ops.php');
    const seedScript = path.join(
      __dirname,
      '../../../../interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php',
    );
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${seedScript}"`, { stdio: 'inherit' });
  });

  test('daily reports scheduling tab shows full analytics sections', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);

    await page.goto(`${MODULE_BASE}/reports.php`);
    const schedulingResp = page.waitForResponse(
      (resp) => resp.url().includes('reports.scheduling') && resp.ok(),
      { timeout: 45000 },
    );
    await page.getByRole('tab', { name: /Scheduling/i }).click();
    const response = await schedulingResp;
    const body = await response.json();
    expect(body.data?.full_analytics?.enabled).toBe(true);

    await expect(page.getByRole('heading', { name: /Slot to check-in latency/i })).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByRole('heading', { name: /Provider utilization/i })).toBeVisible();
    await expect(page.getByText(/Booked today/i)).toBeVisible();
  });

  test('patient chart shows in-chart search and queries API', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);

    await page.goto(`${MODULE_BASE}/patient-chart.php?pid=${CHART_PID}`);
    await expect(page.locator('#nc-patient-chart')).toBeVisible({ timeout: 20000 });

    const searchInput = page.getByRole('searchbox', { name: /Search within chart/i });
    await expect(searchInput).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Informational lookup only/i)).toBeVisible();

    const searchResp = page.waitForResponse(
      (resp) => resp.url().includes('patients.chart.search') && resp.ok(),
      { timeout: 45000 },
    );
    await searchInput.fill(SEARCH_NAME);
    const response = await searchResp;
    const payload = await response.json();
    expect(payload.data).toHaveProperty('items');
    expect(Array.isArray(payload.data.items)).toBe(true);

    const hasResults = payload.data.items.length > 0;
    if (hasResults) {
      await expect(page.locator('.oe-nc-chart-in-chart-search__results')).toBeVisible();
    } else {
      await expect(page.getByText(/No matches in this chart/i)).toBeVisible();
    }
  });

  test('documentation integrity tab loads M7-F19 report', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);

    await page.goto(`${MODULE_BASE}/reports.php`);
    const integrityResp = page.waitForResponse(
      (resp) => resp.url().includes('reports.documentation_integrity') && resp.ok(),
      { timeout: 45000 },
    );
    await page.getByRole('tab', { name: /Doc integrity/i }).click();
    const response = await integrityResp;
    const body = await response.json();
    expect(body.data).toHaveProperty('rows');
    expect(Array.isArray(body.data.rows)).toBe(true);

    await expect(page.getByRole('heading', { name: /Integrity summary/i })).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByText(/E-sign events/i)).toBeVisible();
  });

  test('front desk receives pinned reception preview flag (M1a-F13)', async ({ page }) => {
    test.setTimeout(60_000);
    await login(page, RECEPTION_USER, RECEPTION_PASS);
    await page.goto(`${MODULE_BASE}/front-desk.php`);

    const island = page.locator('[data-island="front-desk"]');
    await expect(island).toBeVisible({ timeout: 30000 });
    const props = JSON.parse((await island.getAttribute('data-props')) ?? '{}');
    expect(props.pinnedPreview).toBe(true);
  });

  test('faster queue interrupts use 10s poll on triage desk (M0-F34)', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);
    await page.goto(`${MODULE_BASE}/triage.php`);
    await expect(page.locator('[data-island="triage-desk"]')).toBeVisible({ timeout: 20000 });

    const pollMs = await readIslandPollMs(page, 'triage-desk');
    expect(pollMs).toBe(10000);
  });
});
