/**
 * Scheduling — recurring appointment drag opens scope modal and commits move.
 *
 * @group e2e
 * @group new-clinic-mandatory
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login: loginAsAdmin } = require('../helpers/auth');
const { parseRecurringFixtureOutput } = require('../helpers/scheduling');

const ADMIN_USER = process.env.TEST_USERNAME_ADMIN || 'Adminstrator';
const ADMIN_PASS = process.env.TEST_PASSWORD_ADMIN || 'passpass1';

const PHP_BIN = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
const MODULE_ROOT = path.join(__dirname, '../../../../interface/modules/custom_modules/oe-module-new-clinic');

function runPhpScript(relativePath, args = '') {
  const script = path.join(MODULE_ROOT, relativePath);
  return execSync(`"${PHP_BIN}" "${script}" ${args}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] });
}

let fixturePatientName = '';
let fixtureProviderId = 0;

test.describe('Scheduling recurring move', () => {
  test.beforeAll(() => {
    runPhpScript('scripts/pilot-enable-scheduling-redesign.php');
    runPhpScript('scripts/scheduling-recurring-fixture-seed.php', '--cleanup');
    const out = runPhpScript('scripts/scheduling-recurring-fixture-seed.php');
    const parsed = parseRecurringFixtureOutput(out);
    fixturePatientName = parsed.patientName;
    fixtureProviderId = parsed.providerId;
  });

  test.afterAll(() => {
    runPhpScript('scripts/scheduling-recurring-fixture-seed.php', '--cleanup');
  });

  test('drag recurring appointment shows scope modal and moves occurrence', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);

    const rangeResp = page.waitForResponse(
      (resp) => resp.url().includes('scheduling.calendar.range') && resp.ok(),
      { timeout: 45000 },
    );
    await page.goto(`${MODULE_BASE}/scheduling/index.php?lens=calendar&provider_id=${fixtureProviderId}`);
    await rangeResp;

    await page.getByRole('button', { name: 'Day grid' }).click();
    await expect(page.locator('.nc-calendar-day')).toBeVisible({ timeout: 15000 });

    const sourceEvent = page.locator('.nc-calendar-day-event').filter({ hasText: fixturePatientName });
    await expect(sourceEvent).toBeVisible({ timeout: 20000 });

    const targetRow = page.locator('tr').filter({
      has: page.getByRole('rowheader', { name: '10:30' }),
    });
    const targetCell = targetRow.locator('.nc-calendar-day-cell').first();
    await expect(targetCell).toBeVisible();

    const moveResp = page.waitForResponse(
      (resp) => resp.url().includes('scheduling.calendar.move') && resp.ok(),
      { timeout: 45000 },
    );

    await sourceEvent.dragTo(targetCell);

    const scopeDialog = page.getByRole('dialog', { name: /Edit recurring appointment/i });
    await expect(scopeDialog).toBeVisible({ timeout: 10000 });
    await scopeDialog.getByRole('button', { name: /Only this occurrence/i }).click();

    const response = await moveResp;
    const body = await response.json();
    expect(body.success).toBeTruthy();

    await expect(scopeDialog).toBeHidden({ timeout: 10000 });
    await expect(page.locator('.alert.alert-warning')).toHaveCount(0);
  });
});
