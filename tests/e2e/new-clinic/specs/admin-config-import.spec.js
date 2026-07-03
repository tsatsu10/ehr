/**
 * Admin Hub — M6 config JSON import dry-run and apply.
 *
 * @group e2e
 * @group new-clinic-mandatory
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login: loginAsAdmin } = require('../helpers/auth');

const ADMIN_USER = process.env.TEST_USERNAME_ADMIN || 'Adminstrator';
const ADMIN_PASS = process.env.TEST_PASSWORD_ADMIN || 'passpass1';
const FIXTURE_JSON = path.join(__dirname, '../fixtures/m6-config-dry-run.json');

const PHP_BIN = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
const MODULE_ROOT = path.join(__dirname, '../../../../interface/modules/custom_modules/oe-module-new-clinic');

function runPhpScript(relativePath) {
  const script = path.join(MODULE_ROOT, relativePath);
  execSync(`"${PHP_BIN}" "${script}"`, { stdio: 'inherit' });
}

test.describe('Admin M6 config import', () => {
  test.beforeAll(() => {
    runPhpScript('scripts/pilot-enable-v11-admin.php');
  });

  test('dry-run preview then apply import on System tab', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);

    const configResp = page.waitForResponse(
      (resp) => resp.url().includes('admin.config') && resp.ok(),
      { timeout: 45000 },
    );
    await page.goto(`${MODULE_BASE}/admin.php`);
    await configResp;

    await page.getByRole('tab', { name: 'System' }).click();
    await expect(page.locator('#nc-admin-config-import')).toBeVisible({ timeout: 20000 });

    const previewResp = page.waitForResponse(
      (resp) => resp.url().includes('config_import') && resp.ok(),
      { timeout: 45000 },
    );

    const fileInput = page.locator('#nc-admin-config-import input[type="file"]');
    await fileInput.setInputFiles(FIXTURE_JSON);
    await previewResp;

    await expect(page.getByText('Import preview')).toBeVisible();
    await expect(page.getByRole('button', { name: /Apply import to this site/i })).toBeEnabled();

    const applyResp = page.waitForResponse(
      (resp) => resp.url().includes('config_import') && resp.ok(),
      { timeout: 45000 },
    );
    await page.getByRole('button', { name: /Apply import to this site/i }).click();
    const applyBody = await (await applyResp).json();

    expect(applyBody.success).toBeTruthy();
    await expect(page.locator('#nc-admin-success')).toContainText(/M6 config imported/i, { timeout: 15000 });
  });
});
