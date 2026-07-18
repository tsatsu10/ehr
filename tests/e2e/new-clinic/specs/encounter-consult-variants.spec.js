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

// Desktop renders one section at a time (focus mode) — only the active section's
// fields are in the DOM, so navigate via the section nav before each fill.
async function gotoConsultSection(page, sectionLabel) {
  const nav = page.getByRole('navigation', { name: 'Consult note sections' });
  await nav.getByRole('button', { name: sectionLabel }).click();
}

// Config rows persist between runs and between tests — pin the knobs each test
// depends on (variant map, supervisor gate, LBF export) at the start of the test.
function setEncounterNoteConfig(args) {
  runModulePhp('scripts/e2e-set-encounter-note-config.php', args);
}

async function fillCoreConsultSections(page, texts) {
  await gotoConsultSection(page, /Chief complaint/);
  await page.locator('#encounter-cc').fill(texts.cc);

  await gotoConsultSection(page, /History of present illness/);
  await page.locator('#encounter-hpi').fill(texts.hpi);

  await gotoConsultSection(page, /Physical examination/);
  await page.locator('#encounter-pe-general').fill(texts.pe);

  await gotoConsultSection(page, /Assessment & plan/);
  // The section seeds a default problem row — only add one when none exists.
  if (await page.getByLabel('Problem label').count() === 0) {
    await page.getByRole('button', { name: 'Add problem' }).click();
  }
  await page.getByLabel('Problem label').first().fill(texts.problem);
  await page.getByLabel('Assessment narrative').first().fill(texts.assessment);
  if (texts.differential) {
    await page.getByLabel('Differential diagnosis').first().fill(texts.differential);
  }
  await page.getByRole('button', { name: 'Add item' }).first().click();
  await page.getByPlaceholder('Plan action / recommendation').first().fill(texts.plan);

  await gotoConsultSection(page, /Follow-up/);
  await page.locator('#encounter-follow-up-instructions').fill(texts.followUp);
}

async function markRosReviewedNegative(page) {
  await gotoConsultSection(page, /Review of systems/);
  const markAllNegative = page.getByRole('button', { name: 'Mark all reviewed negative' });
  if (await markAllNegative.isVisible().catch(() => false)) {
    await markAllNegative.click();
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
    setEncounterNoteConfig('release_doctor=1 map=all supervisor=0 lbf=0');
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
    // Referral is the variant's first section, so it is the active one on load.
    await expect(page.locator('#encounter-clinical-question')).toBeVisible();

    await acknowledgeContextStrip(page);
    await fillCoreConsultSections(page, {
      cc: 'Referral headache consult',
      hpi: 'Referred for specialist opinion.',
      pe: 'Alert, cooperative.',
      problem: 'Headache',
      assessment: 'Needs specialist input.',
      differential: 'Migraine vs tension headache',
      plan: 'Await consultant recommendation.',
      followUp: 'Follow up after consult letter.',
    });
    await markRosReviewedNegative(page);
    await gotoConsultSection(page, /Source of information/);
    await page.locator('#encounter-source-narrative').fill('History provided by the patient.');

    await page.getByRole('button', { name: 'Validate' }).click();
    await expect(page.getByText(/need attention/i)).toBeVisible({ timeout: 15000 });

    await gotoConsultSection(page, /Referral/);
    await page.locator('#encounter-clinical-question').fill('Does this patient need imaging before treatment?');
    await page.locator('#encounter-referring-clinician').fill('Dr Referrer');
    await page.locator('#encounter-referring-service').fill('Medicine');

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
    // Supervisor gate only applies where the attestation section is visible —
    // that is the referral variant, so route this visit there too.
    setEncounterNoteConfig('release_doctor=1 map=all supervisor=1 lbf=0');
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

    await fillCoreConsultSections(page, {
      cc: 'Supervised consult',
      hpi: 'Trainee consult note.',
      pe: 'Normal exam.',
      problem: 'Training case',
      assessment: 'Discussed with supervisor.',
      plan: 'Continue observation.',
      followUp: 'Review in clinic.',
    });

    await page.getByRole('button', { name: 'Validate' }).click();
    await expect(page.getByText(/supervis/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('save returns LBF export payload when export-on-save is enabled', async ({ page }) => {
    test.setTimeout(360_000);
    setEncounterNoteConfig('release_doctor=1 map=none supervisor=0 lbf=1');
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
    await fillCoreConsultSections(page, {
      cc: 'Export on save test',
      hpi: 'Testing optional LBF export.',
      pe: 'Unremarkable.',
      problem: 'Export test',
      assessment: 'Export mapping test.',
      plan: 'Continue care.',
      followUp: 'Return PRN.',
    });

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
    setEncounterNoteConfig('release_doctor=1 map=none supervisor=0 lbf=0');
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
    await fillCoreConsultSections(page, {
      cc: 'Amendment note test',
      hpi: 'Sign with optional signature note.',
      pe: 'Stable.',
      problem: 'Stable visit',
      assessment: 'No acute issues.',
      plan: 'Routine follow-up.',
      followUp: 'Return as needed.',
    });
    await markRosReviewedNegative(page);

    await page.getByRole('button', { name: 'Validate' }).click();
    await expect(page.getByText(/Validation passed/i)).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: 'Sign note' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.locator('#encounter-sign-amendment').fill('Signed after bedside review with patient.');
    await page.locator('#encounter-sign-password').fill(creds.doctor.password);

    const signPromise = page.waitForResponse(
      (resp) => resp.url().includes('encounter_note.sign') && resp.ok(),
      { timeout: 60000 },
    );
    await page.getByRole('dialog').getByRole('button', { name: 'Sign note' }).click();
    await signPromise;

    await expect(page.getByText('Signed after bedside review with patient.')).toBeVisible({ timeout: 15000 });
  });

  test('admin unlock enables edit after sign', async ({ page }) => {
    test.setTimeout(420_000);
    setEncounterNoteConfig('release_doctor=1 map=none supervisor=0 lbf=0');
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
    await fillCoreConsultSections(page, {
      cc: 'Unlock workflow test',
      hpi: 'Initial draft for unlock test.',
      pe: 'Normal.',
      problem: 'Unlock test',
      assessment: 'Initial assessment.',
      plan: 'Initial plan.',
      followUp: 'Initial follow-up.',
    });
    await markRosReviewedNegative(page);

    await page.getByRole('button', { name: 'Validate' }).click();
    await expect(page.getByText(/Validation passed/i)).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: 'Sign note' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.locator('#encounter-sign-password').fill(creds.doctor.password);
    await page.getByRole('dialog').getByRole('button', { name: 'Sign note' }).click();
    await expect(page.getByText('Signed consultation note')).toBeVisible({ timeout: 15000 });

    const consultUrl = page.url();
    await logout(page);
    await login(page, ADMIN_USER, ADMIN_PASS);
    await page.goto(consultUrl);

    await expect(page.getByRole('button', { name: 'Unlock', exact: true })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
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
