/**
 * Pharmacy Operations Hub — worklist, receive stock, write-off lot, OTC drawer smoke.
 *
 * Requires pilot-enable-pharm-ops.php (formulary, stock, write-off lot seed).
 * Receive / destroy require pharmacy_lead_user (New Clinic Pharmacy Lead ACL).
 *
 * @group e2e
 * @group new-clinic-mandatory
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login } = require('../helpers/auth');

test.describe.configure({ timeout: 180_000 });

function pilotPrep() {
  const script = path.join(
    __dirname,
    '../../../../interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-pharm-ops.php',
  );
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  execSync(`"${php}" "${script}"`, { stdio: 'inherit' });
}

function leadCredentials() {
  return {
    username: process.env.TEST_USERNAME_PHARMACY_LEAD || 'pharmacy_lead_user',
    password: process.env.TEST_PASSWORD_PHARMACY_LEAD || process.env.TEST_PASSWORD_PHARMACY || 'test_pass',
  };
}

function pharmacyCredentials() {
  return {
    username: process.env.TEST_USERNAME_PHARMACY || 'pharmacy_user',
    password: process.env.TEST_PASSWORD_PHARMACY || 'test_pass',
  };
}

test.describe('Pharmacy Operations Hub', () => {
  test.beforeAll(() => {
    pilotPrep();
  });

  test('pharmacy user loads hub worklist and tabs', async ({ page }) => {
    const creds = pharmacyCredentials();

    await login(page, creds.username, creds.password);
    await page.goto(`${MODULE_BASE}/pharm-ops/index.php`);

    await expect(page.locator('#nc-pharm-ops-hub')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#nc-pharmops-list')).toBeVisible({ timeout: 15000 });

    await page.waitForResponse(
      (resp) => resp.url().includes('pharm_ops.worklist') && resp.ok(),
      { timeout: 20000 },
    );

    await page.locator('#nc-pharmops-tab-lowstock').click();
    await expect(page.locator('#nc-pharmops-list')).toBeVisible();

    await page.locator('#nc-pharmops-tab-reports').click();
    await expect(page.locator('#nc-pharmops-report-select')).toBeVisible({ timeout: 10000 });

    await page.locator('#nc-pharmops-tab-pending').click();
    await expect(page.locator('#nc-pharmops-list')).toBeVisible();
  });

  test('pharmacy user opens OTC sale drawer', async ({ page }) => {
    const creds = pharmacyCredentials();

    await login(page, creds.username, creds.password);
    await page.goto(`${MODULE_BASE}/pharm-ops/index.php`);
    await expect(page.locator('#nc-pharm-ops-hub')).toBeVisible({ timeout: 20000 });

    await page.locator('#nc-pharmops-sell-otc').click();
    await expect(page.locator('#nc-pharmops-otc-drawer')).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel('Patient')).toBeVisible();
  });

  test('pharmacy lead receives stock and writes off expiring lot', async ({ page }) => {
    const creds = leadCredentials();
    const receiveLot = `E2E-RCV-${Date.now()}`;
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 6);
    const expiryStr = expiry.toISOString().slice(0, 10);

    await login(page, creds.username, creds.password);
    await page.goto(`${MODULE_BASE}/pharm-ops/index.php`);
    await expect(page.locator('#nc-pharm-ops-hub')).toBeVisible({ timeout: 20000 });

    await expect(page.locator('#nc-pharmops-receive')).toBeVisible({ timeout: 10000 });
    await page.locator('#nc-pharmops-receive').click();
    await expect(page.locator('#nc-pharmops-receive-drawer')).toBeVisible({ timeout: 15000 });

    await page.waitForResponse(
      (resp) => resp.url().includes('pharm_ops.receive_get') && resp.ok(),
      { timeout: 20000 },
    );

    const drugField = page.locator('#nc-pharmops-receive-drug');
    await drugField.click();
    await drugField.fill('Para');
    const searchResp = await page.waitForResponse(
      (resp) => resp.url().includes('pharm_ops.otc_drugs_search') && resp.ok(),
      { timeout: 15000 },
    );
    const searchBody = await searchResp.json().catch(() => ({}));
    if (!searchBody?.data?.rows?.length && !searchBody?.rows?.length) {
      throw new Error(`Drug search returned no rows: ${JSON.stringify(searchBody)}`);
    }
    await drugField.click();

    const drugOption = page
      .locator('#nc-pharmops-receive-drawer button.nc-list-group-item-action')
      .filter({ hasText: 'Paracetamol' })
      .first();
    await expect(drugOption).toBeVisible({ timeout: 10000 });
    await drugOption.click();
    await expect(page.locator('#nc-pharmops-receive-drawer')).toContainText('Current QOH', { timeout: 10000 });
    await page.fill('#nc-pharmops-receive-lot', receiveLot);
    await page.fill('#nc-pharmops-receive-exp', expiryStr);
    await page.fill('#nc-pharmops-receive-qty', '12');

    await page.locator('#nc-pharmops-receive-drawer').getByRole('button', { name: 'Confirm receive' }).click();
    await expect(page.getByRole('heading', { name: 'Confirm stock receive' })).toBeVisible();

    const receiveSave = page.waitForResponse(
      (resp) => resp.url().includes('pharm_ops.receive_save') && resp.ok(),
      { timeout: 20000 },
    );
    await page.getByRole('button', { name: 'Receive', exact: true }).click();
    await receiveSave;

    await expect(page.locator('#nc-pharmops-receive-drawer')).toContainText(/Received/i, { timeout: 15000 });
    await page
      .locator('#nc-pharmops-receive-drawer .nc-slide-over-footer')
      .getByRole('button', { name: 'Close' })
      .click();
    await expect(page.locator('#nc-pharmops-receive-drawer')).toBeHidden({ timeout: 10000 });

    await page.locator('#nc-pharmops-tab-writeoff').click();
    await expect(page.locator('#nc-pharmops-list')).toContainText('E2E-WRITEOFF-LOT', { timeout: 15000 });

    await page.getByRole('button', { name: 'Write off lot' }).first().click();
    await expect(page.locator('#nc-pharmops-destroy-drawer')).toBeVisible({ timeout: 15000 });

    await page.waitForResponse(
      (resp) => resp.url().includes('pharm_ops.destroy_get') && resp.ok(),
      { timeout: 20000 },
    );

    await page.fill('#nc-pharmops-destroy-method', 'Incineration');
    await page.fill('#nc-pharmops-destroy-witness', 'E2E pharmacy lead witness');
    await page.fill('#nc-pharmops-destroy-notes', 'E2E write-off golden path');

    const destroyConfirm = page.waitForResponse(
      (resp) => resp.url().includes('pharm_ops.destroy_confirm') && resp.ok(),
      { timeout: 20000 },
    );
    await page.locator('#nc-pharmops-destroy-drawer').getByRole('button', { name: 'Destroy lot' }).first().click();
    await expect(page.getByRole('heading', { name: 'Confirm lot destruction' })).toBeVisible();
    await page.getByRole('button', { name: 'Destroy lot' }).last().click();
    await destroyConfirm;

    await expect(page.locator('#nc-pharmops-destroy-drawer')).toContainText(/marked destroyed/i, {
      timeout: 15000,
    });
  });
});
