/**
 * V1.1-PRINT-RX smoke — PRD M4-F38 community pharmacy Rx PDF (@new-clinic-v11-print-rx).
 *
 * @group e2e
 * @group new-clinic-v11-print-rx
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login, logout } = require('../helpers/auth');

const MODULE_ROOT = path.join(
  __dirname,
  '../../../../interface/modules/custom_modules/oe-module-new-clinic',
);

function runModulePhp(relativePath, args = '') {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, relativePath);
  execSync(`"${php}" "${script}" ${args}`.trim(), { stdio: 'inherit' });
}

function readPrintRxFixture() {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, 'scripts/v11-print-rx-smoke-fixture.php');
  const raw = execSync(`"${php}" "${script}"`, { encoding: 'utf8' }).trim();
  return JSON.parse(raw);
}

function seedPrescription(visitId) {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, 'scripts/v11-print-rx-seed-prescription.php');
  const raw = execSync(`"${php}" "${script}" ${visitId}`, { encoding: 'utf8' }).trim();
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

async function prepareDoctorDesk(page) {
  await page.evaluate(() => {
    sessionStorage.removeItem('doctor_desk_active_visit_id');
    sessionStorage.removeItem('doctor_desk_left_via');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForResponse(
    (resp) => resp.url().includes('doctor.queue') && resp.ok(),
    { timeout: 20000 },
  ).catch(() => {});
}

async function triageSendPatient(page, lname) {
  const triageCard = await waitForQueueCard(page, lname);
  await expect(triageCard).toBeVisible({ timeout: 30000 });
  await triageCard.click();
  await expect(page.locator('#nc-triage-active-pane')).toContainText(lname, { timeout: 15000 });

  const startTriage = page.getByRole('button', { name: 'Start triage' });
  if (await startTriage.isVisible().catch(() => false)) {
    await startTriage.click();
    await page.waitForTimeout(500);
  }

  await page.locator('#nc-vitals-bps').waitFor({ state: 'visible', timeout: 15000 });
  await page.fill('#nc-vitals-bps', '118');
  await page.fill('#nc-vitals-bpd', '76');
  await page.fill('#nc-vitals-pulse', '70');
  await page.fill('#nc-vitals-temperature', '36.7');
  await page.fill('#nc-vitals-weight', '68');
  await page.fill('#nc-vitals-respiration', '16');
  await page.getByRole('button', { name: 'Save vitals' }).click();
  await page.getByRole('button', { name: 'Send to doctor' }).click();
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
  };
}

test.describe('V1.1-PRINT-RX smoke', () => {
  test.beforeAll(() => {
    runModulePhp('bin/upgrade_sql.php');
    runModulePhp('scripts/e2e-prep-golden-path.php');
    runModulePhp('scripts/pilot-enable-v11-print-rx.php');
    const seedScript = path.join(MODULE_ROOT, 'acl/seed_pilot_users.php');
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${seedScript}"`, { stdio: 'inherit' });
  });

  test('doctor desk exposes print Rx without pharm ops hub', async ({ page }) => {
    test.setTimeout(90_000);
    const fixture = readPrintRxFixture();
    const creds = credentials();

    expect(fixture.enable_rx_print, JSON.stringify(fixture)).toBe(true);
    expect(fixture.enable_pharm_ops, JSON.stringify(fixture)).toBe(false);
    expect(fixture.paracetamol_drug_id, JSON.stringify(fixture)).toBeGreaterThan(0);

    await login(page, creds.doctor.username, creds.doctor.password);
    await page.goto(`${MODULE_BASE}/doctor.php`);

    const island = page.locator('[data-island="doctor-desk"]');
    await expect(island).toBeVisible({ timeout: 20000 });
    const props = JSON.parse((await island.getAttribute('data-props')) ?? '{}');
    expect(props.formularyRxEnabled).toBe(false);
  });

  test('doctor prints community Rx PDF for active prescription', async ({ page }) => {
    test.setTimeout(300_000);
    const fixture = readPrintRxFixture();
    const creds = credentials();

    await test.step('Nurse sends patient to doctor pool', async () => {
      await login(page, creds.nurse.username, creds.nurse.password);
      await page.goto(`${MODULE_BASE}/triage.php`);
      await triageSendPatient(page, fixture.lname);
      await logout(page);
    });

    await test.step('Doctor takes patient, seeds Rx, and prints PDF', async () => {
      await login(page, creds.doctor.username, creds.doctor.password);
      await page.goto(`${MODULE_BASE}/doctor.php`);
      await prepareDoctorDesk(page);

      const doctorCard = await waitForQueueCard(page, fixture.lname);
      const takeResp = page.waitForResponse(
        (resp) => resp.url().includes('doctor.take') && resp.ok(),
        { timeout: 45000 },
      );
      await doctorCard.click();
      const takeBody = await (await takeResp).json();
      expect(takeBody.success, JSON.stringify(takeBody)).toBe(true);
      const visitId = takeBody.data?.visit?.id ?? fixture.visit_id;
      await expect(page.locator('#nc-doctor-active-pane')).toContainText(fixture.lname, {
        timeout: 20000,
      });

      const seed = seedPrescription(visitId);
      expect(seed.prescription_id, JSON.stringify(seed)).toBeGreaterThan(0);

      const activeResp = page.waitForResponse(
        (resp) => resp.url().includes('doctor.active') && resp.ok(),
        { timeout: 45000 },
      );
      await page.reload({ waitUntil: 'domcontentloaded' });
      const activeBody = await (await activeResp).json();
      expect(activeBody.success, JSON.stringify(activeBody)).toBe(true);
      expect(activeBody.data?.rx_print_enabled, JSON.stringify(activeBody.data)).toBe(true);
      expect(activeBody.data?.can_print_rx, JSON.stringify(activeBody.data)).toBe(true);

      await expect(page.locator('#nc-doctor-rx-stock-panel')).toContainText('Paracetamol', {
        timeout: 15000,
      });

      const printResp = page.waitForResponse(
        (resp) => resp.url().includes('rx_print_pdf') && resp.ok(),
        { timeout: 45000 },
      );
      await page.getByRole('button', { name: /Print Rx for Paracetamol/i }).click();
      const printBody = await (await printResp).json();
      expect(printBody.success, JSON.stringify(printBody)).toBe(true);
      expect(printBody.data?.print_url, JSON.stringify(printBody.data)).toBeTruthy();

      const printUrl = new URL(printBody.data.print_url, page.url()).toString();
      const printPage = await page.request.get(printUrl);
      expect(printPage.ok(), await printPage.text()).toBe(true);
      await expect(printPage.text()).resolves.toContain('Paracetamol');
    });
  });
});
