/**
 * V1.1-HIST-WRAP smoke — T1 shell on stock History editor (T1-F20b).
 *
 * @group e2e
 * @group new-clinic-mandatory
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { login: loginAsAdmin, BASE_URL } = require('../helpers/auth');

const ADMIN_USER = process.env.TEST_USERNAME_ADMIN || 'Adminstrator';
const ADMIN_PASS = process.env.TEST_PASSWORD_ADMIN || 'passpass1';
const CHART_PID = Number(process.env.TEST_CHART_PID || '4');

const SCRIPTS_DIR = path.join(
  __dirname,
  '../../../../interface/modules/custom_modules/oe-module-new-clinic/scripts',
);

function runPhpScript(scriptName) {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(SCRIPTS_DIR, scriptName);
  execSync(`"${php}" "${script}"`, { stdio: 'inherit' });
}

test.describe('V1.1-HIST-WRAP smoke', () => {
  test.beforeAll(() => {
    runPhpScript('pilot-enable-history-editor-wrap.php');
  });

  test('history editor shows T1 wrap and Back to chart via set_pid deep link', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);

    const editorUrl =
      `${BASE_URL}/interface/patient_file/history/history_full.php`
      + `?set_pid=${CHART_PID}&return=clinical-background`;

    await page.goto(editorUrl);
    await expect(page.locator('#nc-history-editor-wrap')).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('link', { name: /Back to chart/i }).first()).toBeVisible();
    await expect(page.locator('body.nc-history-editor-wrap')).toBeVisible();
  });
});
