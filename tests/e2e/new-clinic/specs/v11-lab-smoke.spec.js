/**
 * V1.1-LAB smoke — PRD LAB-1–LAB-8 subset (@new-clinic-v11-lab).
 *
 * M12 hub worklist tabs + setup wizard starter panel status.
 *
 * @group e2e
 * @group new-clinic-v11-lab
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login } = require('../helpers/auth');

const MODULE_ROOT = path.join(
  __dirname,
  '../../../../interface/modules/custom_modules/oe-module-new-clinic',
);

function runModulePhp(relativePath) {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, relativePath);
  execSync(`"${php}" "${script}"`, { stdio: 'inherit' });
}

function readLabFixture() {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, 'scripts/v11-lab-smoke-fixture.php');
  const raw = execSync(`"${php}" "${script}"`, { encoding: 'utf8' }).trim();
  return JSON.parse(raw);
}

function credentials() {
  return {
    lab: {
      username: process.env.TEST_USERNAME_LAB || 'lab_user',
      password: process.env.TEST_PASSWORD_LAB || 'test_pass',
    },
    admin: {
      username: process.env.TEST_USERNAME_ADMIN || 'Adminstrator',
      password: process.env.TEST_PASSWORD_ADMIN || 'passpass1',
    },
  };
}

test.describe('V1.1-LAB smoke', () => {
  test.beforeAll(() => {
    runModulePhp('bin/upgrade_sql.php');
    runModulePhp('scripts/pilot-enable-v11-lab.php');
    const seedScript = path.join(MODULE_ROOT, 'acl/seed_pilot_users.php');
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${seedScript}"`, { stdio: 'inherit' });
  });

  test('lab user loads hub worklist and tabs', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = readLabFixture();
    const creds = credentials();

    expect(fixture.enable_lab_ops, JSON.stringify(fixture)).toBe(true);

    await login(page, creds.lab.username, creds.lab.password);

    const worklistResp = page.waitForResponse(
      (resp) => resp.url().includes('lab_ops.worklist') && resp.ok(),
      { timeout: 45000 },
    );
    await page.goto(`${MODULE_BASE}/lab-ops/index.php`);
    const response = await worklistResp;
    const body = await response.json();
    expect(body.success, JSON.stringify(body)).toBe(true);
    expect(Array.isArray(body.data?.rows)).toBe(true);
    expect(body.data?.counts).toBeTruthy();

    await expect(page.locator('#nc-lab-ops-hub')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#nc-labops-list')).toBeVisible({ timeout: 15000 });

    await page.locator('#nc-labops-tab-progress').click();
    await expect(page.locator('#nc-labops-list')).toBeVisible();

    await page.locator('#nc-labops-tab-sendout').click();
    await expect(page.locator('#nc-labops-list')).toBeVisible();
  });

  test('admin setup panel shows starter panel ready', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = readLabFixture();
    const creds = credentials();

    expect(fixture.has_starter_panel, JSON.stringify(fixture)).toBe(true);

    await login(page, creds.admin.username, creds.admin.password);

    const setupResp = page.waitForResponse(
      (resp) => resp.url().includes('lab_ops.setup_status') && resp.ok(),
      { timeout: 45000 },
    );
    await page.goto(`${MODULE_BASE}/lab-ops/index.php`);
    const response = await setupResp;
    const body = await response.json();
    expect(body.success, JSON.stringify(body)).toBe(true);
    expect(body.data?.has_starter_panel, JSON.stringify(body.data)).toBe(true);
    expect((body.data?.test_count ?? 0), JSON.stringify(body.data)).toBeGreaterThanOrEqual(5);

    await expect(page.locator('#nc-labops-setup')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Starter panel ready/i)).toBeVisible();
    await expect(page.getByText(/Lab setup/i)).toBeVisible();
  });

  test('LAB-5 regression — lab desk still loads when hub flag ON', async ({ page }) => {
    test.setTimeout(90_000);
    const creds = credentials();

    await login(page, creds.lab.username, creds.lab.password);

    const queueResp = page.waitForResponse(
      (resp) => resp.url().includes('lab.queue') && resp.ok(),
      { timeout: 45000 },
    );
    await page.goto(`${MODULE_BASE}/lab.php`);
    const response = await queueResp;
    const body = await response.json();
    expect(body.success, JSON.stringify(body)).toBe(true);

    await expect(page.locator('[data-island="lab-desk"]')).toBeVisible({ timeout: 20000 });
  });
});
