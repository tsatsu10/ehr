/**
 * S1 Scheduling & Flow — shell smoke (flow lens loads).
 *
 * Manual QA checklist (after deploy, use &v=ModuleAssetVersion):
 * - Calendar: agenda/day/week/month toggle; drag on day/week/month; resize on day grid
 * - Flow Board: poll without flash; drag card across lanes; room save; lane collapse prefs
 * - Recalls: book from recall; check-in closes loop
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
    '../../../../interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-scheduling.php',
  );
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  execSync(`"${php}" "${script}"`, { stdio: 'inherit' });
}

test.describe('Scheduling & Flow shell', () => {
  test.beforeAll(() => {
    pilotPrep();
  });

  test('admin loads calendar lens', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);

    const dayResp = page.waitForResponse(
      (resp) => resp.url().includes('scheduling.calendar.range') && resp.ok(),
      { timeout: 45000 },
    );
    await page.goto(`${MODULE_BASE}/scheduling/index.php?lens=calendar`);
    await dayResp;

    await expect(page.locator('#nc-scheduling-root')).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('tab', { name: 'Calendar' })).toBeVisible();
    // The layout switcher is a SegmentedControl tablist, not a group.
    await expect(page.getByRole('tablist', { name: 'Calendar layout' })).toBeVisible();
  });

  test('admin loads recalls lens', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);

    const recallsResp = page.waitForResponse(
      (resp) => resp.url().includes('scheduling.recalls.list') && resp.ok(),
      { timeout: 45000 },
    );
    await page.goto(`${MODULE_BASE}/scheduling/index.php?lens=recalls`);
    await recallsResp;

    await expect(page.locator('#nc-scheduling-root')).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('tab', { name: 'Recalls' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Due now/i })).toBeVisible();
  });

  test('admin loads flow lens', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);

    const boardResp = page.waitForResponse(
      (resp) => resp.url().includes('scheduling.flow_board.list') && resp.ok(),
      { timeout: 45000 },
    );
    await page.goto(`${MODULE_BASE}/scheduling/index.php?lens=flow`);
    await boardResp;

    await expect(page.locator('#nc-scheduling-root')).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('tab', { name: 'Flow Board' })).toBeVisible();
    await expect(page.getByText(/Mode 2 arrivals only/i)).toBeVisible();
  });

  test('admin toggles flow board list view', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);

    const boardResp = page.waitForResponse(
      (resp) => resp.url().includes('scheduling.flow_board.list') && resp.ok(),
      { timeout: 45000 },
    );
    await page.goto(`${MODULE_BASE}/scheduling/index.php?lens=flow`);
    await boardResp;

    // SegmentedControl renders role=tab (was role=button pre-redesign).
    await page.getByRole('tab', { name: 'List' }).click();
    await expect(page.getByRole('columnheader', { name: 'Patient' })).toBeVisible();
    await page.getByRole('tab', { name: 'Board' }).click();
    await expect(page.locator('.nc-flowboard-board')).toBeVisible();
  });

  test('admin switches calendar to week layout', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);

    const dayResp = page.waitForResponse(
      (resp) => resp.url().includes('scheduling.calendar.range') && resp.ok(),
      { timeout: 45000 },
    );
    await page.goto(`${MODULE_BASE}/scheduling/index.php?lens=calendar`);
    await dayResp;

    // SegmentedControl renders role=tab (was role=button pre-redesign).
    await page.getByRole('tab', { name: 'Week' }).click();
    await expect(page.locator('.nc-calendar-week')).toBeVisible();
    await expect(page.locator('.nc-calendar-week thead tr').nth(1).locator('th')).not.toHaveCount(0);
  });

  test('admin daily reports scheduling tab loads KPIs', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);

    await page.goto(`${MODULE_BASE}/reports.php`);
    const schedulingResp = page.waitForResponse(
      (resp) => resp.url().includes('reports.scheduling') && resp.ok(),
      { timeout: 45000 },
    );
    await page.getByRole('tab', { name: /Scheduling/i }).click();
    await schedulingResp;

    await expect(page.getByText(/Booked today/i)).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Booked this week/i)).toBeVisible();
    await expect(page.getByText(/do not add them together/i)).toBeVisible();
  });
});
