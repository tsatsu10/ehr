/**
 * V1.1-RT smoke — PRD §16.1 test 33 (@new-clinic-v11-rt).
 *
 * RTa: on-duty roster bar. RTb: routing_suggested_provider_id on ready_for_doctor;
 * paused doctors excluded; Take patient still succeeds for any doctor.
 *
 * @group e2e
 * @group new-clinic-v11-rt
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

function readRtFixture() {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, 'scripts/v11-rt-smoke-fixture.php');
  const raw = execSync(`"${php}" "${script}"`, { encoding: 'utf8' }).trim();
  return JSON.parse(raw);
}

async function waitForQueueCard(page, lname) {
  const card = page.locator(`[class*="queue-card"]:has-text("${lname}")`).first();
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await card.isVisible().catch(() => false) && await card.isEnabled().catch(() => false)) {
      return card;
    }
    const refresh = page.getByRole('button', { name: 'Refresh' });
    if (await refresh.isVisible().catch(() => false)) {
      await refresh.click();
    }
    await page.waitForTimeout(2000);
  }
  await expect(card, 'queue card must be enabled — clear doctor active consult first').toBeEnabled({
    timeout: 5000,
  });
  return card;
}

async function resetDoctorDeskSession(page) {
  await page.evaluate(() => {
    sessionStorage.removeItem('doctor_desk_active_visit_id');
    sessionStorage.removeItem('doctor_desk_left_via');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
}

async function triageSendPatient(page, lname) {
  const triageCard = await waitForQueueCard(page, lname);
  await expect(triageCard).toBeVisible({ timeout: 30000 });

  const selectResp = page.waitForResponse(
    (resp) => resp.url().includes('triage.select') && resp.ok(),
    { timeout: 30000 },
  );
  await triageCard.click();
  await selectResp;
  await expect(page.locator('#nc-triage-active-pane')).toContainText(lname, { timeout: 15000 });

  const startTriage = page.getByRole('button', { name: 'Start triage' });
  if (await startTriage.isVisible().catch(() => false)) {
    await startTriage.click();
    await page.waitForTimeout(500);
  }

  const reenter = page.getByRole('button', { name: 'Record another set' });
  if (await reenter.isVisible().catch(() => false)) {
    await reenter.click();
  }

  await page.locator('#nc-vitals-bps').waitFor({ state: 'visible', timeout: 15000 });
  await page.fill('#nc-vitals-bps', '118');
  await page.fill('#nc-vitals-bpd', '76');
  await page.fill('#nc-vitals-pulse', '70');
  await page.fill('#nc-vitals-temperature', '36.7');
  await page.fill('#nc-vitals-weight', '65');
  await page.fill('#nc-vitals-respiration', '16');

  const saveResp = page.waitForResponse(
    (resp) => resp.url().includes('triage.save_vitals') && resp.ok(),
    { timeout: 30000 },
  );
  await page.getByRole('button', { name: 'Save vitals' }).click();
  const saveBody = await (await saveResp).json();
  expect(saveBody.success, JSON.stringify(saveBody)).toBe(true);

  const sendButton = page.getByRole('button', { name: 'Send to doctor' });
  await expect(sendButton).toBeVisible({ timeout: 20000 });

  const sendResp = page.waitForResponse(
    (resp) => resp.url().includes('triage.send_doctor') && resp.ok(),
    { timeout: 30000 },
  );
  await sendButton.click();
  const sendResponse = await sendResp;
  const sendBody = await sendResponse.json();
  expect(sendBody.success, JSON.stringify(sendBody)).toBe(true);
  expect(sendBody.data?.visit?.state, JSON.stringify(sendBody)).toBe('ready_for_doctor');

  return sendBody;
}

function credentials() {
  return {
    nurse: {
      username: process.env.TEST_USERNAME_NURSE || 'nurse_user',
      password: process.env.TEST_PASSWORD_NURSE || 'test_pass',
    },
    doctor: {
      username: process.env.TEST_USERNAME_DOCTOR || 'doctor_user',
      password: process.env.TEST_PASSWORD_DOCTOR || 'test_pass',
    },
    doctor2: {
      username: process.env.TEST_USERNAME_DOCTOR2 || 'doctor2_user',
      password: process.env.TEST_PASSWORD_DOCTOR2 || 'test_pass',
    },
  };
}

test.describe('V1.1-RT smoke', () => {
  test.beforeAll(() => {
    runModulePhp('bin/upgrade_sql.php');
    runModulePhp('scripts/pilot-enable-v11-rt.php');
    runModulePhp('scripts/e2e-prep-golden-path.php');
    runModulePhp('scripts/v11-rt-smoke-fixture.php');
    const seedScript = path.join(MODULE_ROOT, 'acl/seed_pilot_users.php');
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${seedScript}"`, { stdio: 'inherit' });
  });

  test('doctor roster bar loads on Doctor Desk (RTa)', async ({ page }) => {
    test.setTimeout(90_000);
    const creds = credentials();

    await login(page, creds.doctor.username, creds.doctor.password);
    await page.goto(`${MODULE_BASE}/doctor.php`);

    await expect(page.locator('[data-island="doctor-desk"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#nc-doctor-roster')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/On-duty doctors/i)).toBeVisible();
    await expect(page.getByText(/Pilot Doctor/i).first()).toBeVisible();
  });

  test('advisory routing suggests on-duty doctor; paused doctor can still take', async ({ page }) => {
    test.setTimeout(300_000);
    const fixture = readRtFixture();
    const creds = credentials();
    const { visit, primary_doctor: primaryDoctor, secondary_doctor: secondaryDoctor } = fixture;

    await test.step('Nurse sends patient — routing_suggested_provider_id set to on-duty doctor', async () => {
      await login(page, creds.nurse.username, creds.nurse.password);

      const queueResp = page.waitForResponse(
        (resp) => resp.url().includes('triage.queue') && resp.ok(),
        { timeout: 45000 },
      );
      await page.goto(`${MODULE_BASE}/triage.php`);
      const queueBody = await (await queueResp).json();
      expect(queueBody.success, JSON.stringify(queueBody)).toBe(true);

      const sendBody = await triageSendPatient(page, visit.lname);
      const suggestedId = Number(sendBody.data?.visit?.routing_suggested_provider_id ?? 0);
      expect(suggestedId, JSON.stringify(sendBody.data?.visit)).toBe(primaryDoctor.user_id);
      expect(suggestedId, 'paused doctor must not be suggested').not.toBe(secondaryDoctor.user_id);

      await logout(page);
    });

    await test.step('Primary doctor queue shows Routing suggests chip', async () => {
      await login(page, creds.doctor.username, creds.doctor.password);
      await page.goto(`${MODULE_BASE}/doctor.php`);
      await resetDoctorDeskSession(page);

      const doctorCard = await waitForQueueCard(page, visit.lname);
      await expect(doctorCard.getByText(/Routing suggests:/i)).toContainText(primaryDoctor.display_name, {
        timeout: 15000,
      });

      await logout(page);
    });

    await test.step('Paused secondary doctor takes patient from All queue', async () => {
      await logout(page);
      runModulePhp('scripts/release-pilot-doctor-desks.php');
      await login(page, creds.doctor2.username, creds.doctor2.password);
      await page.goto(`${MODULE_BASE}/doctor.php`);
      await resetDoctorDeskSession(page);

      const scopeSelect = page.locator('#nc-doctor-scope');
      if (await scopeSelect.isVisible().catch(() => false)) {
        await scopeSelect.selectOption('all');
        await page.waitForTimeout(500);
      }

      const doctorCard = await waitForQueueCard(page, visit.lname);
      await expect(doctorCard).toBeVisible({ timeout: 20000 });

      const takeResp = page.waitForResponse(
        (resp) => resp.url().includes('doctor.take') && resp.ok(),
        { timeout: 45000 },
      );
      await doctorCard.click();
      const takeBody = await (await takeResp).json();
      expect(takeBody.success, JSON.stringify(takeBody)).toBe(true);

      await expect(page.locator('#nc-doctor-active-pane')).toContainText(visit.lname, {
        timeout: 20000,
      });
    });
  });
});
