/**
 * V1.1-ADMIN smoke — PRD M15 Admin Operations Hub (@new-clinic-v11-admin).
 *
 * @group e2e
 * @group new-clinic-v11-admin
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login } = require('../helpers/auth');

const MODULE_ROOT = path.join(
  __dirname,
  '../../../../interface/modules/custom_modules/oe-module-new-clinic',
);

const ADMIN_USER = process.env.TEST_USERNAME_ADMIN || 'Adminstrator';
const ADMIN_PASS = process.env.TEST_PASSWORD_ADMIN || 'passpass1';

function runModulePhp(relativePath) {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, relativePath);
  execSync(`"${php}" "${script}"`, { stdio: 'inherit' });
}

function readAdminFixture() {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, 'scripts/v11-admin-smoke-fixture.php');
  const raw = execSync(`"${php}" "${script}"`, { encoding: 'utf8' }).trim();
  return JSON.parse(raw);
}

test.describe('V1.1-ADMIN smoke', () => {
  test.beforeAll(() => {
    runModulePhp('bin/upgrade_sql.php');
    runModulePhp('scripts/pilot-enable-v11-admin.php');
    const seedScript = path.join(MODULE_ROOT, 'acl/seed_pilot_users.php');
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${seedScript}"`, { stdio: 'inherit' });
  });

  test('admin hub loads with config, health, and runbooks APIs', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = readAdminFixture();

    expect(fixture.enable_admin_hub, JSON.stringify(fixture)).toBe(true);
    expect(fixture.runbook_count, JSON.stringify(fixture)).toBeGreaterThan(0);
    expect(fixture.forms_catalog_count, JSON.stringify(fixture)).toBeGreaterThan(0);
    expect(fixture.has_system_health, JSON.stringify(fixture)).toBe(true);

    await login(page, ADMIN_USER, ADMIN_PASS);

    const configResp = page.waitForResponse(
      (resp) => resp.url().includes('admin.config') && resp.ok(),
      { timeout: 45000 },
    );
    await page.goto(`${MODULE_BASE}/admin.php`);
    const configBody = await (await configResp).json();

    expect(configBody.success, JSON.stringify(configBody)).toBe(true);
    expect(configBody.data?.settings?.enable_admin_hub, JSON.stringify(configBody.data?.settings)).toBe(true);
    expect((configBody.data?.runbooks?.cards ?? []).length).toBeGreaterThan(0);
    expect((configBody.data?.forms_catalog?.items ?? []).length).toBeGreaterThan(0);

    await expect(page.locator('#nc-admin-desk')).toBeVisible({ timeout: 20000 });
    // ADM-2: the wrapped tab strip became a sidebar nav — items are links now.
    await expect(page.getByRole('link', { name: 'System' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Forms' })).toBeVisible();
  });

  test('clinical role is denied admin hub access', async ({ page }) => {
    test.setTimeout(60_000);
    const nurseUser = process.env.TEST_USERNAME_NURSE || 'nurse_user';
    const nursePass = process.env.TEST_PASSWORD_NURSE || 'test_pass';

    await login(page, nurseUser, nursePass);
    const response = await page.goto(`${MODULE_BASE}/admin.php`);
    expect(response?.status(), await page.content()).toBe(403);
  });

  test('system tab shows health checklist and searchable runbooks', async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, ADMIN_USER, ADMIN_PASS);

    const configResp = page.waitForResponse(
      (resp) => resp.url().includes('admin.config') && resp.ok(),
      { timeout: 45000 },
    );
    await page.goto(`${MODULE_BASE}/admin.php`);
    await configResp;

    await page.getByRole('link', { name: 'System' }).click();
    await expect(page.locator('#nc-admin-runbooks')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('RB-01', { exact: false }).first()).toBeVisible();

    const search = page.getByRole('searchbox', { name: 'Search runbooks' });
    await search.fill('backup');
    await expect(page.getByText('RB-01', { exact: false }).first()).toBeVisible();
  });

  test('forms tab shows registered forms catalog', async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, ADMIN_USER, ADMIN_PASS);

    const configResp = page.waitForResponse(
      (resp) => resp.url().includes('admin.config') && resp.ok(),
      { timeout: 45000 },
    );
    await page.goto(`${MODULE_BASE}/admin.php`);
    await configResp;

    await page.getByRole('link', { name: 'Forms' }).click();
    await expect(page.locator('#nc-admin-forms-catalog')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#nc-admin-form-bundle-board')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#nc-admin-forms-catalog tbody tr').first()).toBeVisible({
      timeout: 15000,
    });
  });
});
