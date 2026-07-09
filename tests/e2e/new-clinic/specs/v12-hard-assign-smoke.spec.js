/**
 * V1.2 hard assignment smoke — PRD §16.1 test 34 (@new-clinic-v12).
 *
 * Nurse hard-assigns at Send to doctor; assigned doctor sees chip and can take patient.
 *
 * @group e2e
 * @group new-clinic-v12
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login, logout } = require('../helpers/auth');

const MODULE_ROOT = path.join(
  __dirname,
  '../../../../interface/modules/custom_modules/oe-module-new-clinic',
);

function runModulePhp(relativePath) {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, relativePath);
  execSync(`"${php}" "${script}"`, { stdio: 'inherit' });
}

function readSmokeFixture() {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, 'scripts/v12-hard-assign-smoke-fixture.php');
  const raw = execSync(`"${php}" "${script}"`, { encoding: 'utf8' }).trim();
  return JSON.parse(raw);
}

async function waitForQueueCard(page, lname) {
  const card = page.locator(`[class*="queue-card"]:has-text("${lname}")`).first();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (await card.isVisible().catch(() => false) && await card.isEnabled().catch(() => false)) {
      return card;
    }
    const refresh = page.getByRole('button', { name: 'Refresh' });
    if (await refresh.isVisible().catch(() => false)) {
      await refresh.click();
    }
    await page.waitForTimeout(2000);
  }
  return card;
}

function credentials() {
  return {
    admin: {
      username: process.env.TEST_USERNAME_ADMIN || 'Adminstrator',
      password: process.env.TEST_PASSWORD_ADMIN || 'passpass1',
    },
    doctor: {
      username: process.env.TEST_USERNAME_DOCTOR || 'doctor_user',
      password: process.env.TEST_PASSWORD_DOCTOR || 'test_pass',
    },
  };
}

test.describe('V1.2 hard assign smoke', () => {
  test.beforeAll(() => {
    runModulePhp('bin/upgrade_sql.php');
    runModulePhp('scripts/pilot-enable-v12-hard-assign.php');
    runModulePhp('scripts/e2e-prep-golden-path.php');
    const seedScript = path.join(MODULE_ROOT, 'acl/seed_pilot_users.php');
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${seedScript}"`, { stdio: 'inherit' });
  });

  test('nurse hard-assigns doctor; assigned doctor takes patient', async ({ page }) => {
    test.setTimeout(300_000);
    const fixture = readSmokeFixture();
    const creds = credentials();
    const assignDoctorLabel = process.env.TEST_HARD_ASSIGN_DOCTOR_LABEL || 'Pilot Doctor';

    await test.step('Triage vitals and hard-assign at send to doctor', async () => {
      // Admin has new_hard_assign_provider (nurse_user does not — ACL is on lead groups).
      await login(page, creds.admin.username, creds.admin.password);

      const queueResp = page.waitForResponse(
        (resp) => resp.url().includes('triage.queue') && resp.ok(),
        { timeout: 45000 },
      );
      await page.goto(`${MODULE_BASE}/triage.php`);
      const queueResponse = await queueResp;
      const queueBody = await queueResponse.json();
      expect(queueBody.success, JSON.stringify(queueBody)).toBe(true);

      const triageCard = await waitForQueueCard(page, fixture.lname);
      await expect(triageCard).toBeVisible({ timeout: 30000 });
      await triageCard.click();
      await expect(page.locator('#nc-triage-active-pane')).toContainText(fixture.lname, { timeout: 15000 });

      const startTriage = page.getByRole('button', { name: 'Start triage' });
      if (await startTriage.isVisible().catch(() => false)) {
        await startTriage.click();
        await page.waitForTimeout(500);
      }

      await page.fill('#nc-vitals-bps', '118');
      await page.fill('#nc-vitals-bpd', '76');
      await page.fill('#nc-vitals-pulse', '70');
      await page.fill('#nc-vitals-temperature', '36.8');
      await page.fill('#nc-vitals-weight', '68');
      await page.fill('#nc-vitals-respiration', '16');
      await page.getByRole('button', { name: 'Save vitals' }).click();
      await expect(page.getByRole('button', { name: 'Send to doctor' })).toBeVisible({ timeout: 10000 });

      await page.getByRole('button', { name: 'Send to doctor' }).click();

      const doctorSelect = page.locator('#nc-triage-hard-assign-doctor');
      await expect(doctorSelect).toBeVisible({ timeout: 10000 });
      const doctorOptions = await doctorSelect.locator('option').allTextContents();
      const doctorOption = doctorOptions.find((label) => /Pilot Doctor/i.test(label));
      expect(doctorOption, `doctor roster options: ${doctorOptions.join(' | ')}`).toBeTruthy();
      await doctorSelect.selectOption({ label: doctorOption.trim() });

      const sendResp = page.waitForResponse(
        (resp) => resp.url().includes('triage.send_doctor') && resp.ok(),
        { timeout: 30000 },
      );
      await page.getByRole('button', { name: 'Send to doctor pool' }).click();
      await sendResp;
      await logout(page);
    });

    await test.step('Assigned doctor sees chip and takes patient', async () => {
      await login(page, creds.doctor.username, creds.doctor.password);
      await page.goto(`${MODULE_BASE}/doctor.php`);

      await page.waitForResponse(
        (resp) => resp.url().includes('doctor.queue') && resp.ok(),
        { timeout: 30000 },
      ).catch(() => {});

      const doctorCard = await waitForQueueCard(page, fixture.lname);
      await expect(doctorCard.getByText(/Assigned:/i)).toContainText(assignDoctorLabel, {
        timeout: 15000,
      });

      await doctorCard.click();
      await expect(page.locator('#nc-doctor-active-pane')).toContainText(fixture.lname, {
        timeout: 20000,
      });
    });
  });
});
