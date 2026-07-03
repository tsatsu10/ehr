/**
 * Queue Bridge Hub — M18 smoke (exception lenses + scheduling footer embed).
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

function pilotPrep() {
  const script = path.join(
    __dirname,
    '../../../../interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-bridge.php',
  );
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  execSync(`"${php}" "${script}"`, { stdio: 'inherit' });
}

test.describe('Queue Bridge Hub', () => {
  test.beforeAll(() => {
    pilotPrep();
  });

  test('admin loads hub and scheduling tab shows exception footer', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);

    const listResp = page.waitForResponse(
      (resp) => resp.url().includes('queue_bridge.list') && resp.ok(),
      { timeout: 45000 },
    );
    await page.goto(`${MODULE_BASE}/queue-bridge/index.php`);
    await listResp;

    await expect(page.locator('#nc-queue-bridge-root')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.oe-nc-queuebridge')).toBeVisible();

    await page.goto(`${MODULE_BASE}/reports.php`);
    const schedulingResp = page.waitForResponse(
      (resp) => resp.url().includes('reports.scheduling') && resp.ok(),
      { timeout: 45000 },
    );
    await page.getByRole('tab', { name: /Scheduling/i }).click();
    await schedulingResp;

    await expect(page.getByText(/Schedule vs queue exceptions/i)).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('link', { name: 'View exceptions' })).toBeVisible();
  });
});
