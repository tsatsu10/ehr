/**
 * V1.2-PHARM-RX smoke — PRD M4-F37 doctor formulary quick prescribe (@new-clinic-v12-pharm-rx).
 *
 * @group e2e
 * @group new-clinic-v12-pharm-rx
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

function readPharmRxFixture() {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, 'scripts/v12-pharm-rx-smoke-fixture.php');
  const raw = execSync(`"${php}" "${script}"`, { encoding: 'utf8' }).trim();
  return JSON.parse(raw);
}

async function waitForQueueCard(page, lname) {
  const card = page.locator(`.nc-queue-card:has-text("${lname}")`).first();
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
  await page.fill('#nc-vitals-bps', '120');
  await page.fill('#nc-vitals-bpd', '78');
  await page.fill('#nc-vitals-pulse', '72');
  await page.fill('#nc-vitals-temperature', '36.8');
  await page.fill('#nc-vitals-weight', '65');
  await page.fill('#nc-vitals-respiration', '18');
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

test.describe('V1.2-PHARM-RX smoke', () => {
  test.beforeAll(() => {
    runModulePhp('bin/upgrade_sql.php');
    runModulePhp('scripts/pilot-enable-v12-pharm-rx.php');
    runModulePhp('scripts/e2e-prep-golden-path.php');
    const seedScript = path.join(MODULE_ROOT, 'acl/seed_pilot_users.php');
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${seedScript}"`, { stdio: 'inherit' });
  });

  test('doctor desk exposes formulary Rx flag and catalog', async ({ page }) => {
    test.setTimeout(90_000);
    const fixture = readPharmRxFixture();
    const creds = credentials();

    expect(fixture.catalog_enabled, JSON.stringify(fixture)).toBe(true);
    expect(fixture.catalog_has_drugs, JSON.stringify(fixture)).toBe(true);

    await login(page, creds.doctor.username, creds.doctor.password);
    await page.goto(`${MODULE_BASE}/doctor.php`);

    const island = page.locator('[data-island="doctor-desk"]');
    await expect(island).toBeVisible({ timeout: 20000 });
    const props = JSON.parse((await island.getAttribute('data-props')) ?? '{}');
    expect(props.formularyRxEnabled).toBe(true);

    const catalogUrl = `${props.ajaxUrl}?action=doctor.formulary_rx_catalog${
      props.facilityId ? `&facility_id=${props.facilityId}` : ''
    }`;
    const response = await page.request.get(catalogUrl);
    expect(response.ok(), await response.text()).toBe(true);
    const body = await response.json();
    expect(body.success, JSON.stringify(body)).toBe(true);
    expect(body.data?.has_catalog, JSON.stringify(body.data)).toBe(true);
    expect((body.data?.drugs ?? []).length).toBeGreaterThan(0);
  });

  test('doctor quick prescribes Paracetamol during consult', async ({ page }) => {
    test.setTimeout(300_000);
    const fixture = readPharmRxFixture();
    const creds = credentials();

    await test.step('Nurse sends patient to doctor pool', async () => {
      await login(page, creds.nurse.username, creds.nurse.password);
      await page.goto(`${MODULE_BASE}/triage.php`);
      await triageSendPatient(page, fixture.lname);
      await logout(page);
    });

    await test.step('Doctor takes patient and prescribes from formulary', async () => {
      await login(page, creds.doctor.username, creds.doctor.password);
      await page.goto(`${MODULE_BASE}/doctor.php`);
      await prepareDoctorDesk(page);

      const doctorCard = await waitForQueueCard(page, fixture.lname);
      const takeResp = page.waitForResponse(
        (resp) => resp.url().includes('doctor.take') && resp.ok(),
        { timeout: 45000 },
      );
      await doctorCard.click();
      await takeResp;
      await expect(page.locator('#nc-doctor-active-pane')).toContainText(fixture.lname, {
        timeout: 20000,
      });

      const quickRx = page.getByRole('button', { name: 'Quick prescribe' });
      await expect(quickRx).toBeVisible({ timeout: 15000 });

      const catalogResp = page.waitForResponse(
        (resp) => resp.url().includes('formulary_rx_catalog') && resp.ok(),
        { timeout: 45000 },
      );
      await quickRx.click();
      const catalogBody = await (await catalogResp).json();
      expect(catalogBody.success, JSON.stringify(catalogBody)).toBe(true);
      expect(catalogBody.data?.has_catalog, JSON.stringify(catalogBody.data)).toBe(true);

      await expect(page.locator('#nc-doctor-formulary-rx-modal')).toBeVisible({ timeout: 15000 });

      const paracetamolLabel = page
        .locator('label[for^="nc-formulary-rx-drug-"]')
        .filter({ hasText: 'Paracetamol' });
      await expect(paracetamolLabel).toBeVisible({ timeout: 15000 });
      const drugInputId = await paracetamolLabel.getAttribute('for');
      await page.locator(`#${drugInputId}`).check();

      const placeResp = page.waitForResponse(
        (resp) => resp.url().includes('formulary_rx_place') && resp.ok(),
        { timeout: 45000 },
      );
      await page.locator('#nc-formulary-rx-place').click();
      const placeBody = await (await placeResp).json();
      expect(placeBody.success, JSON.stringify(placeBody)).toBe(true);
      expect(
        placeBody.data?.prescription_count ?? placeBody.data?.prescription_ids?.length,
        JSON.stringify(placeBody.data),
      ).toBeGreaterThan(0);

      await expect(page.locator('#nc-doctor-formulary-rx-modal')).toBeHidden({ timeout: 15000 });
      await expect(page.locator('#nc-doctor-active-pane')).toContainText('Paracetamol', {
        timeout: 15000,
      });
    });
  });
});
