/**
 * V1.1-DOC smoke — PRD M17 Clinical Documentation Hub (@new-clinic-v11-doc).
 *
 * @group e2e
 * @group new-clinic-v11-doc
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login, logout } = require('../helpers/auth');

const MODULE_ROOT = path.join(
  __dirname,
  '../../../../interface/modules/custom_modules/oe-module-new-clinic',
);

const ADMIN_USER = process.env.TEST_USERNAME_ADMIN || 'Adminstrator';
const ADMIN_PASS = process.env.TEST_PASSWORD_ADMIN || 'passpass1';

function runModulePhp(relativePath, args = '') {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, relativePath);
  execSync(`"${php}" "${script}" ${args}`.trim(), { stdio: 'inherit' });
}

function readDocFixture() {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, 'scripts/v11-doc-smoke-fixture.php');
  const raw = execSync(`"${php}" "${script}"`, { encoding: 'utf8' }).trim();
  return JSON.parse(raw);
}

async function waitForQueueCard(page, lname) {
  const card = page.locator(`.nc-queue-card:has-text("${lname}")`).first();
  for (let attempt = 0; attempt < 15; attempt += 1) {
    if (await card.isVisible().catch(() => false) && await card.isEnabled().catch(() => false)) {
      return card;
    }
    const refresh = page.locator('#nc-doctor-refresh');
    if (await refresh.isVisible().catch(() => false)) {
      await refresh.click();
      await page.waitForResponse(
        (resp) => resp.url().includes('doctor.queue') && resp.ok(),
        { timeout: 20000 },
      ).catch(() => {});
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

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const completeBtn = page.locator('#nc-doctor-complete-btn');
    if (await completeBtn.isVisible().catch(() => false) && await completeBtn.isEnabled().catch(() => false)) {
      await completeBtn.click();
      await expect(page.locator('#nc-doctor-routing-modal')).toBeVisible();
      const labCheckbox = page.locator('#nc-routing-lab');
      if (await labCheckbox.isChecked().catch(() => false)) {
        await labCheckbox.uncheck();
      }
      const rxCheckbox = page.locator('#nc-routing-rx');
      if (await rxCheckbox.isChecked().catch(() => false)) {
        await rxCheckbox.uncheck();
      }
      await page.locator('#nc-routing-confirm').click();
      await expect(page.locator('#nc-doctor-routing-modal')).toBeHidden({ timeout: 15000 });
      await page.locator('#nc-doctor-refresh').click();
      await page.waitForTimeout(1000);
      continue;
    }
    break;
  }
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
  await page.fill('#nc-vitals-bpd', '80');
  await page.fill('#nc-vitals-pulse', '72');
  await page.fill('#nc-vitals-temperature', '37.0');
  await page.fill('#nc-vitals-weight', '70');
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
    reception: {
      username: process.env.TEST_USERNAME_RECEPTION || 'reception_user',
      password: process.env.TEST_PASSWORD_RECEPTION || 'test_pass',
    },
  };
}

test.describe('V1.1-DOC smoke', () => {
  test.beforeAll(() => {
    runModulePhp('bin/upgrade_sql.php');
    runModulePhp('scripts/e2e-prep-golden-path.php');
    runModulePhp('scripts/pilot-enable-v11-doc.php');
    const seedScript = path.join(MODULE_ROOT, 'acl/seed_pilot_users.php');
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${seedScript}"`, { stdio: 'inherit' });
  });

  test('admin hub loads consult catalog API', async ({ page }) => {
    test.setTimeout(90_000);
    const fixture = readDocFixture();

    expect(fixture.enable_clinical_doc_hub, JSON.stringify(fixture)).toBe(true);
    expect(fixture.clinical_doc_bundle, JSON.stringify(fixture)).toBe('ghana_opd_v1');

    await login(page, ADMIN_USER, ADMIN_PASS);
    await page.goto(`${MODULE_BASE}/clinical-doc/index.php`);

    await expect(page.locator('#nc-clinical-doc')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#nc-clinicaldoc-toolbar button[data-tab="visit"]')).toBeVisible();
    await expect(page.locator('#nc-clinicaldoc-toolbar button[data-tab="consult"]')).toBeVisible();

    const island = page.locator('[data-island="clinical-doc"]');
    const props = JSON.parse((await island.getAttribute('data-props')) ?? '{}');
    expect(props.canConsult).toBe(true);

    const catalogUrl = `${props.ajaxUrl}?action=clinical_doc.catalog&lens=consult${
      props.facilityId ? `&facility_id=${props.facilityId}` : ''
    }`;
    const response = await page.request.get(catalogUrl);
    expect(response.ok(), await response.text()).toBe(true);
    const body = await response.json();
    expect(body.success, JSON.stringify(body)).toBe(true);
    expect((body.data?.cards ?? []).length).toBeGreaterThan(0);

    await page.locator('#nc-clinicaldoc-toolbar button[data-tab="consult"]').click();
    await expect(page.getByText(/Go to Doctor Desk/i)).toBeVisible({ timeout: 15000 });
  });

  test('doctor open documentation routes to hub with visit context', async ({ page }) => {
    test.setTimeout(300_000);
    const fixture = readDocFixture();
    const creds = credentials();

    await test.step('Nurse sends patient to doctor pool', async () => {
      await login(page, creds.nurse.username, creds.nurse.password);
      await page.goto(`${MODULE_BASE}/triage.php`);
      await triageSendPatient(page, fixture.lname);
      await logout(page);
    });

    await test.step('Doctor opens documentation hub from consult', async () => {
      await login(page, creds.doctor.username, creds.doctor.password);
      await page.goto(`${MODULE_BASE}/doctor.php`);
      await prepareDoctorDesk(page);

      const doctorCard = await waitForQueueCard(page, fixture.lname);
      await doctorCard.click();
      await expect(page.locator('#nc-doctor-active-pane')).toContainText(fixture.lname, {
        timeout: 30000,
      });
      await expect(page.locator('.nc-shortcut-btn[data-shortcut="encounter_hub"]')).toBeVisible({
        timeout: 30000,
      });

      const preflightPromise = page.waitForResponse(
        (resp) => resp.url().includes('doctor.shortcut_preflight') && resp.ok(),
        { timeout: 60000 },
      );
      const navigationPromise = page.waitForURL(/clinical-doc\/index\.php/, { timeout: 60000 });
      await page.locator('.nc-shortcut-btn[data-shortcut="encounter_hub"]').click();
      await Promise.all([preflightPromise, navigationPromise]);

      await expect(page).toHaveURL(/clinical-doc\/index\.php\?visit_id=\d+/, { timeout: 20000 });
      await expect(page.locator('#nc-clinical-doc')).toBeVisible({ timeout: 20000 });
      await expect(page.locator('#nc-clinicaldoc-toolbar button[data-tab="visit"]')).toBeVisible();
    });
  });

  test('reception role is denied clinical doc hub access', async ({ page }) => {
    test.setTimeout(60_000);
    const creds = credentials();

    await login(page, creds.reception.username, creds.reception.password);
    const response = await page.goto(`${MODULE_BASE}/clinical-doc/index.php`);
    expect(response?.status(), await page.content()).toBe(403);
  });
});
