/**
 * Native encounter consult — referral variant, supervisor gate, LBF export, amendment, unlock.
 *
 * @group e2e
 * @group new-clinic-encounter-consult
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login, logout } = require('../helpers/auth');
const { registerAndStartVisit } = require('../helpers/registration');

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

function credentials() {
  return {
    reception: {
      username: process.env.TEST_USERNAME_RECEPTION || 'reception_user',
      password: process.env.TEST_PASSWORD_RECEPTION || 'test_pass',
    },
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

function generatePatientName() {
  const timestamp = Date.now();
  const suffix = String(timestamp).slice(-8);
  // Registration validates names as letters-only — map digits to letters.
  const letterSuffix = suffix.replace(/\d/g, (d) => 'abcdefghij'[Number(d)]);
  return {
    fname: `Etoe${letterSuffix.slice(0, 4)}`,
    lname: `Var${letterSuffix}`,
    fullName: `Etoe${letterSuffix.slice(0, 4)} Var${letterSuffix}`,
    phone: `0247${suffix.slice(-6).padStart(6, '0')}`,
    nationalId: `GHVAR${timestamp}`,
  };
}

async function waitForQueueCard(page, lname) {
  const card = page.locator(`[class*="queue-card"]:has-text("${lname}")`).first();
  for (let attempt = 0; attempt < 15; attempt += 1) {
    if (await card.isVisible().catch(() => false) && await card.isEnabled().catch(() => false)) {
      return card;
    }
    const refresh = page.locator('#nc-doctor-refresh, #nc-triage-refresh').first();
    if (await refresh.isVisible().catch(() => false)) {
      await refresh.click();
      await page.waitForResponse(
        (resp) => (resp.url().includes('doctor.queue') || resp.url().includes('triage.queue')) && resp.ok(),
        { timeout: 20000 },
      ).catch(() => {});
    }
    await page.waitForTimeout(2000);
  }
  return card;
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

async function openNativeConsultFromDoctorDesk(page, creds, lname) {
  await login(page, creds.doctor.username, creds.doctor.password);
  await page.goto(`${MODULE_BASE}/doctor.php`);

  const doctorCard = await waitForQueueCard(page, lname);
  await doctorCard.click();
  await expect(page.locator('#nc-doctor-active-pane')).toContainText(lname, { timeout: 30000 });

  const preflightPromise = page.waitForResponse(
    (resp) => resp.url().includes('doctor.shortcut_preflight') && resp.ok(),
    { timeout: 60000 },
  );
  const navigationPromise = page.waitForURL(/clinical-doc\/index\.php/, { timeout: 60000 });
  await page.locator('.nc-shortcut-btn[data-shortcut="encounter_hub"]').click();
  await Promise.all([preflightPromise, navigationPromise]);

  const consultCard = page.locator('.nc-clinicaldoc-card').filter({ hasText: 'Consultation note' });
  await expect(consultCard).toBeVisible({ timeout: 20000 });

  const openFormPromise = page.waitForResponse(
    (resp) => resp.url().includes('clinical_doc.open_form') && resp.ok(),
    { timeout: 60000 },
  );
  const formNavigation = page.waitForURL(/encounter-consult\.php/, { timeout: 60000 });
  await consultCard.getByRole('button', { name: 'Open form' }).click();
  await Promise.all([openFormPromise, formNavigation]);

  await expect(page.locator('#nc-encounter-consult-root')).toBeVisible({ timeout: 30000 });
}

async function acknowledgeContextStrip(page) {
  const allergyAck = page.locator('label:has-text("I reviewed the allergy information") input[type="checkbox"]');
  if (await allergyAck.isVisible().catch(() => false)) {
    await allergyAck.check();
  }
  const medsAck = page.locator('label:has-text("I reviewed the medication list") input[type="checkbox"]');
  if (await medsAck.isVisible().catch(() => false)) {
    await medsAck.check();
  }
}

test.describe('Native encounter consult variants', () => {
  test.beforeAll(() => {
    runModulePhp('bin/upgrade_sql.php');
    runModulePhp('scripts/e2e-prep-golden-path.php');
    runModulePhp('scripts/pilot-enable-v11-doc.php');
    runModulePhp('scripts/pilot-enable-native-encounter-note.php');
    runModulePhp('scripts/pilot-enable-encounter-consult-e2e-variants.php');
    const seedScript = path.join(MODULE_ROOT, 'acl/seed_pilot_users.php');
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${seedScript}"`, { stdio: 'inherit' });
  });

  test('referral variant blocks validate until clinical question is filled', async ({ page }) => {
    test.setTimeout(360_000);
    const creds = credentials();
    const patient = generatePatientName();

    await login(page, creds.reception.username, creds.reception.password);
    await page.goto(`${MODULE_BASE}/front-desk.php`);
    await registerAndStartVisit(page, patient);
    await logout(page);

    await login(page, creds.nurse.username, creds.nurse.password);
    await page.goto(`${MODULE_BASE}/triage.php`);
    await triageSendPatient(page, patient.lname);
    await logout(page);

    await openNativeConsultFromDoctorDesk(page, creds, patient.lname);

    await expect(page.getByText('Referral consult')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#encounter-clinical-question')).toBeVisible();

    await acknowledgeContextStrip(page);
    await page.locator('#encounter-cc').fill('Referral headache consult');
    await page.locator('#encounter-hpi').fill('Referred for specialist opinion.');
    await page.locator('#encounter-pe-general').fill('Alert, cooperative.');
    await page.getByRole('button', { name: 'Add problem' }).click();
    await page.getByLabel('Problem label').fill('Headache');
    await page.getByLabel('Assessment narrative').fill('Needs specialist input.');
    await page.getByLabel('Differential diagnosis').fill('Migraine vs tension headache');
    await page.getByRole('button', { name: 'Add item' }).click();
    await page.getByPlaceholder('Plan action / recommendation').fill('Await consultant recommendation.');
    await page.locator('#encounter-follow-up-instructions').fill('Follow up after consult letter.');

    await page.getByRole('button', { name: 'Validate' }).click();
    await expect(page.getByText(/need attention/i)).toBeVisible({ timeout: 15000 });

    await page.locator('#encounter-clinical-question').fill('Does this patient need imaging before treatment?');
    await page.locator('#encounter-referring-clinician').fill('Dr Referrer');
    await page.locator('#encounter-referring-service').fill('Medicine');

    const attestationNav = page.getByRole('button', { name: 'Attestation' });
    if (await attestationNav.isVisible().catch(() => false)) {
      await attestationNav.click();
    }
    const attestationCheckbox = page.locator('label:has-text("I attest that this consult note was reviewed") input[type="checkbox"]');
    if (await attestationCheckbox.isVisible().catch(() => false)) {
      await attestationCheckbox.check();
    }

    const validatePromise = page.waitForResponse(
      (resp) => resp.url().includes('encounter_note.validate') && resp.ok(),
      { timeout: 60000 },
    );
    await page.getByRole('button', { name: 'Validate' }).click();
    const validateResp = await validatePromise;
    const validateJson = await validateResp.json();
    expect(validateJson.data?.valid, JSON.stringify(validateJson)).toBe(true);
  });

  test('supervisor-required config blocks validate until attestation', async ({ page }) => {
    test.setTimeout(360_000);
    const creds = credentials();
    const patient = generatePatientName();

    await login(page, creds.reception.username, creds.reception.password);
    await page.goto(`${MODULE_BASE}/front-desk.php`);
    await registerAndStartVisit(page, patient);
    await logout(page);

    await login(page, creds.nurse.username, creds.nurse.password);
    await page.goto(`${MODULE_BASE}/triage.php`);
    await triageSendPatient(page, patient.lname);
    await logout(page);

    await openNativeConsultFromDoctorDesk(page, creds, patient.lname);
    await acknowledgeContextStrip(page);

    await page.locator('#encounter-cc').fill('Supervised consult');
    await page.locator('#encounter-hpi').fill('Trainee consult note.');
    await page.locator('#encounter-pe-general').fill('Normal exam.');
    await page.getByRole('button', { name: 'Add problem' }).click();
    await page.getByLabel('Problem label').fill('Training case');
    await page.getByLabel('Assessment narrative').fill('Discussed with supervisor.');
    await page.getByRole('button', { name: 'Add item' }).click();
    await page.getByPlaceholder('Plan action / recommendation').fill('Continue observation.');
    await page.locator('#encounter-follow-up-instructions').fill('Review in clinic.');

    await page.getByRole('button', { name: 'Validate' }).click();
    await expect(page.getByText(/supervis/i)).toBeVisible({ timeout: 15000 });
  });

  test('save returns LBF export payload when export-on-save is enabled', async ({ page }) => {
    test.setTimeout(360_000);
    const creds = credentials();
    const patient = generatePatientName();

    await login(page, creds.reception.username, creds.reception.password);
    await page.goto(`${MODULE_BASE}/front-desk.php`);
    await registerAndStartVisit(page, patient);
    await logout(page);

    await login(page, creds.nurse.username, creds.nurse.password);
    await page.goto(`${MODULE_BASE}/triage.php`);
    await triageSendPatient(page, patient.lname);
    await logout(page);

    await openNativeConsultFromDoctorDesk(page, creds, patient.lname);
    await acknowledgeContextStrip(page);
    await page.locator('#encounter-cc').fill('Export on save test');
    await page.locator('#encounter-hpi').fill('Testing optional LBF export.');
    await page.locator('#encounter-pe-general').fill('Unremarkable.');
    await page.getByRole('button', { name: 'Add problem' }).click();
    await page.getByLabel('Problem label').fill('Export test');
    await page.getByLabel('Assessment narrative').fill('Export mapping test.');
    await page.getByRole('button', { name: 'Add item' }).click();
    await page.getByPlaceholder('Plan action / recommendation').fill('Continue care.');
    await page.locator('#encounter-follow-up-instructions').fill('Return PRN.');

    const savePromise = page.waitForResponse(
      (resp) => resp.url().includes('encounter_note.save') && resp.ok(),
      { timeout: 60000 },
    );
    await page.getByRole('button', { name: 'Save draft' }).click();
    const saveResp = await savePromise;
    const saveJson = await saveResp.json();
    expect(saveJson.success, JSON.stringify(saveJson)).toBe(true);
    expect(saveJson.data?.lbf_export).toBeTruthy();
    expect(
      saveJson.data.lbf_export.exported === true || saveJson.data.lbf_export.skipped === true,
      JSON.stringify(saveJson.data.lbf_export),
    ).toBe(true);
  });

  test('signature amendment note appears on signed banner', async ({ page }) => {
    test.setTimeout(360_000);
    const creds = credentials();
    const patient = generatePatientName();

    await login(page, creds.reception.username, creds.reception.password);
    await page.goto(`${MODULE_BASE}/front-desk.php`);
    await registerAndStartVisit(page, patient);
    await logout(page);

    await login(page, creds.nurse.username, creds.nurse.password);
    await page.goto(`${MODULE_BASE}/triage.php`);
    await triageSendPatient(page, patient.lname);
    await logout(page);

    await openNativeConsultFromDoctorDesk(page, creds, patient.lname);
    await acknowledgeContextStrip(page);
    await page.locator('#encounter-cc').fill('Amendment note test');
    await page.locator('#encounter-hpi').fill('Sign with optional signature note.');
    await page.locator('#encounter-pe-general').fill('Stable.');
    await page.getByRole('button', { name: 'Add problem' }).click();
    await page.getByLabel('Problem label').fill('Stable visit');
    await page.getByLabel('Assessment narrative').fill('No acute issues.');
    await page.getByRole('button', { name: 'Add item' }).click();
    await page.getByPlaceholder('Plan action / recommendation').fill('Routine follow-up.');
    await page.locator('#encounter-follow-up-instructions').fill('Return as needed.');

    await page.getByRole('button', { name: 'Validate' }).click();
    await expect(page.getByText(/Validation passed/i)).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: 'Sign' }).click();
    await page.locator('#encounter-sign-amendment').fill('Signed after bedside review with patient.');
    await page.locator('#encounter-sign-password').fill(creds.doctor.password);

    const signPromise = page.waitForResponse(
      (resp) => resp.url().includes('encounter_note.sign') && resp.ok(),
      { timeout: 60000 },
    );
    await page.getByRole('button', { name: 'Sign note' }).click();
    await signPromise;

    await expect(page.getByText('Signed after bedside review with patient.')).toBeVisible({ timeout: 15000 });
  });

  test('admin unlock enables edit after sign', async ({ page }) => {
    test.setTimeout(420_000);
    const creds = credentials();
    const patient = generatePatientName();

    await login(page, creds.reception.username, creds.reception.password);
    await page.goto(`${MODULE_BASE}/front-desk.php`);
    await registerAndStartVisit(page, patient);
    await logout(page);

    await login(page, creds.nurse.username, creds.nurse.password);
    await page.goto(`${MODULE_BASE}/triage.php`);
    await triageSendPatient(page, patient.lname);
    await logout(page);

    await openNativeConsultFromDoctorDesk(page, creds, patient.lname);
    await acknowledgeContextStrip(page);
    await page.locator('#encounter-cc').fill('Unlock workflow test');
    await page.locator('#encounter-hpi').fill('Initial draft for unlock test.');
    await page.locator('#encounter-pe-general').fill('Normal.');
    await page.getByRole('button', { name: 'Add problem' }).click();
    await page.getByLabel('Problem label').fill('Unlock test');
    await page.getByLabel('Assessment narrative').fill('Initial assessment.');
    await page.getByRole('button', { name: 'Add item' }).click();
    await page.getByPlaceholder('Plan action / recommendation').fill('Initial plan.');
    await page.locator('#encounter-follow-up-instructions').fill('Initial follow-up.');

    await page.getByRole('button', { name: 'Validate' }).click();
    await expect(page.getByText(/Validation passed/i)).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: 'Sign' }).click();
    await page.locator('#encounter-sign-password').fill(creds.doctor.password);
    await page.getByRole('button', { name: 'Sign note' }).click();
    await expect(page.getByText('Signed consultation note')).toBeVisible({ timeout: 15000 });

    const consultUrl = page.url();
    await logout(page);
    await login(page, ADMIN_USER, ADMIN_PASS);
    await page.goto(consultUrl);

    await expect(page.getByRole('button', { name: 'Unlock for correction' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Unlock for correction' }).click();
    await page.locator('#encounter-unlock-reason').fill('Manager-approved correction after sign');
    await page.locator('#encounter-unlock-password').fill(ADMIN_PASS);

    const unlockPromise = page.waitForResponse(
      (resp) => resp.url().includes('encounter_note.unlock') && resp.ok(),
      { timeout: 60000 },
    );
    await page.getByRole('button', { name: 'Unlock note' }).click();
    await unlockPromise;

    await expect(page.locator('#encounter-cc')).toBeEditable({ timeout: 15000 });
    await page.locator('#encounter-cc').fill('Corrected chief complaint after unlock');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText(/Saved/i)).toBeVisible({ timeout: 15000 });
  });
});
