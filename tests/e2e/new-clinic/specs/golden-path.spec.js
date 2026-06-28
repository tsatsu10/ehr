/**
 * New Clinic E2E Golden Path Test (Test 23)
 *
 * Registration → triage vitals → doctor consult/route → cashier payment (or zero close).
 *
 * @group e2e
 * @group new-clinic-mandatory
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login, logout } = require('../helpers/auth');

test.describe.configure({ timeout: 300_000 });

function generatePatientName() {
  const timestamp = Date.now();
  const suffix = String(timestamp).slice(-8);
  return {
    fname: `E2E${suffix.slice(0, 4)}`,
    lname: `Pt${suffix}`,
    fullName: `E2E${suffix.slice(0, 4)} Pt${suffix}`,
    phone: `0244${suffix.slice(-6).padStart(6, '0')}`,
    nationalId: `GHA${timestamp}`,
  };
}

async function confirmDupIfNeeded(page) {
  const dupCheckbox = page.getByRole('checkbox', { name: /Different patient/i });
  if (await dupCheckbox.isVisible().catch(() => false)) {
    await dupCheckbox.setChecked(true);
    await expect(dupCheckbox).toBeChecked();
  }
}

async function waitForQueueCard(page, lname) {
  const card = page.locator(`.nc-queue-card:has-text("${lname}")`).first();
  for (let attempt = 0; attempt < 8; attempt += 1) {
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

async function resetDoctorDeskSession(page) {
  await page.evaluate(() => {
    sessionStorage.removeItem('doctor_desk_active_visit_id');
    sessionStorage.removeItem('doctor_desk_left_via');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
}

async function prepareDoctorDesk(page) {
  await resetDoctorDeskSession(page);

  await page.waitForResponse(
    (resp) => resp.url().includes('doctor.queue') && resp.ok(),
    { timeout: 20000 },
  ).catch(() => {});

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const loading = page.getByText('Loading consult');
    if (await loading.isVisible().catch(() => false)) {
      await expect(loading).toBeHidden({ timeout: 20000 });
    }

    const completeBtn = page.locator('#nc-doctor-complete-btn');
    if (await completeBtn.isVisible().catch(() => false) && await completeBtn.isEnabled().catch(() => false)) {
      await completeBtn.click();
      await expect(page.locator('#nc-doctor-routing-modal')).toBeVisible();
      const labCheckbox = page.locator('#nc-routing-lab');
      if (await labCheckbox.isChecked().catch(() => false)) {
        await labCheckbox.uncheck();
      }
      await page.locator('#nc-routing-confirm').click();
      await expect(page.locator('#nc-doctor-routing-modal')).toBeHidden({ timeout: 15000 });
      await page.getByRole('button', { name: 'Refresh' }).click();
      await page.waitForTimeout(1000);
      continue;
    }
    break;
  }
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
    cashier: {
      username: process.env.TEST_USERNAME_CASHIER || 'cashier_user',
      password: process.env.TEST_PASSWORD_CASHIER || 'test_pass',
    },
  };
}

test.describe('New Clinic Golden Path Workflow', () => {
  test.beforeAll(() => {
    const script = path.join(
      __dirname,
      '../../../../interface/modules/custom_modules/oe-module-new-clinic/scripts/e2e-reset-doctor-consults.php',
    );
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${script}"`, { stdio: 'inherit' });
  });

  test('complete patient journey from registration to payment', async ({ page }) => {
    const patient = generatePatientName();
    const creds = credentials();
    let queueNumber;
    let visitClosed = false;

    await test.step('Register patient and start visit', async () => {
      await login(page, creds.reception.username, creds.reception.password);
      await page.goto(`${MODULE_BASE}/front-desk.php`);

      await page.locator('#nc-add-patient').click();
      await page.locator('#nc-reg-fname').waitFor({ state: 'visible' });

      await page.fill('#nc-reg-fname', patient.fname);
      await page.fill('#nc-reg-lname', patient.lname);
      await page.fill('#nc-reg-dob-s1', '1990-01-01');
      await page.selectOption('#nc-reg-sex', { label: 'Male' });
      await page.fill('#nc-reg-phone', patient.phone);
      const dupWait = page.waitForResponse(
        (resp) => resp.url().includes('dup_check') && resp.ok(),
        { timeout: 15000 },
      ).catch(() => {});
      await page.fill('#nc-reg-national-id', patient.nationalId);
      await page.locator('#nc-reg-national-id').blur();
      await dupWait;
      await page.waitForTimeout(400);

      for (let attempt = 0; attempt < 3; attempt += 1) {
        await confirmDupIfNeeded(page);
        await page.locator('#nc-reg-save-start').click();
        const regError = page.locator('#nc-reg-error');
        if (!(await regError.isVisible().catch(() => false))) {
          break;
        }
        const message = (await regError.textContent()) ?? '';
        if (!/different patient/i.test(message)) {
          throw new Error(`Registration failed: ${message}`);
        }
        await page.waitForTimeout(500);
      }

      const regError = page.locator('#nc-reg-error');
      await expect(regError).toBeHidden({ timeout: 15000 }).catch(async () => {
        throw new Error(`Registration failed: ${await regError.textContent()}`);
      });

      const startSuccess = page.locator('#nc-start-visit-success');
      const startError = page.locator('#nc-start-visit-error');
      await expect(startSuccess).toBeVisible({ timeout: 60000 });
      if (await startError.isVisible().catch(() => false)) {
        throw new Error(`Start visit failed: ${await startError.textContent()}`);
      }

      const successText = await startSuccess.textContent();
      queueNumber = successText?.match(/#(\d+)/)?.[1];
    });

    await test.step('Enter vitals in triage', async () => {
      await logout(page);
      await login(page, creds.nurse.username, creds.nurse.password);
      await page.goto(`${MODULE_BASE}/triage.php`);

      const triageCard = await waitForQueueCard(page, patient.lname);
      await triageCard.click();
      await expect(page.locator('#nc-triage-active-pane')).toContainText(patient.lname, { timeout: 15000 });

      const startTriage = page.getByRole('button', { name: 'Start triage' });
      if (await startTriage.isVisible().catch(() => false)) {
        await startTriage.click();
        await page.waitForTimeout(500);
      }

      await page.fill('#nc-vitals-bps', '120');
      await page.fill('#nc-vitals-bpd', '80');
      await page.fill('#nc-vitals-pulse', '72');
      await page.fill('#nc-vitals-temperature', '37.0');
      await page.fill('#nc-vitals-weight', '70');
      await page.fill('#nc-vitals-respiration', '16');

      await page.getByRole('button', { name: 'Save vitals' }).click();
      await expect(page.getByRole('button', { name: 'Send to doctor' })).toBeVisible({ timeout: 10000 });

      await page.getByRole('button', { name: 'Send to doctor' }).click();
      await expect(page.locator('.alert-success, #nc-triage-active-pane')).toBeVisible({ timeout: 10000 });
    });

    await test.step('Doctor consultation and routing', async () => {
      await logout(page);
      await login(page, creds.doctor.username, creds.doctor.password);
      await page.goto(`${MODULE_BASE}/doctor.php`);
      await prepareDoctorDesk(page);

      const doctorCard = await waitForQueueCard(page, patient.lname);
      await doctorCard.click();
      await expect(page.locator('#nc-doctor-active-pane')).toContainText(
        patient.lname,
        { timeout: 20000 },
      );

      await expect(page.locator('.nc-shortcut-btn[data-shortcut="encounter"]')).toBeVisible();
      await expect(page.locator('.nc-shortcut-btn[data-shortcut="lab"]')).toBeVisible();

      await page.locator('#nc-doctor-complete-btn').click();
      await expect(page.locator('#nc-doctor-routing-modal')).toBeVisible();

      const labCheckbox = page.locator('#nc-routing-lab');
      if (await labCheckbox.isChecked().catch(() => false)) {
        await labCheckbox.uncheck();
      }

      await page.locator('#nc-routing-confirm').click();
      await expect(page.locator('.alert-success, #nc-doctor-routing-modal')).toBeHidden({ timeout: 15000 });
    });

    await test.step('Cashier payment or zero close', async () => {
      await logout(page);
      await login(page, creds.cashier.username, creds.cashier.password);
      await page.goto(`${MODULE_BASE}/cashier.php`);

      const cashierCard = await waitForQueueCard(page, patient.lname);
      await cashierCard.click();
      await expect(page.locator('#nc-cashier-active-pane')).toContainText(patient.lname, { timeout: 15000 });

      const closeZeroBtn = page.locator('#nc-cashier-close-zero-btn');
      if (await closeZeroBtn.isVisible().catch(() => false)) {
        await closeZeroBtn.click();
        await expect(page.getByRole('heading', { name: 'Close without charge' })).toBeVisible();
        await page.fill('#nc-cashier-close-zero-reason', 'E2E golden path — no charges on visit');
        await page.locator('.modal.show').getByRole('button', { name: 'Confirm' }).click();
        await expect(page.getByRole('heading', { name: 'Close without charge' })).toBeHidden({
          timeout: 15000,
        });
        await expect(page.locator(`.nc-queue-card:has-text("${patient.lname}")`)).toHaveCount(0, {
          timeout: 15000,
        });
        visitClosed = true;
        return;
      }

      const totalDue = await page.locator('#nc-cashier-active-pane input[readonly]').first().inputValue();
      const amount = totalDue && parseFloat(totalDue.replace(/[^\d.]/g, '')) > 0
        ? totalDue.replace(/[^\d.]/g, '')
        : '50.00';

      await page.fill('#nc-cash-received', amount);
      await page.locator('#nc-cashier-pay-btn').click();

      if (await page.locator('#nc-cashier-pay-confirm-modal').isVisible().catch(() => false)) {
        await page.locator('#nc-cashier-pay-confirm-btn').click();
      }

      await expect(page.locator('#nc-cashier-receipt-modal, .alert-success')).toBeVisible({ timeout: 15000 });
      visitClosed = true;
    });

    await test.step('Verify journey completed', async () => {
      expect(visitClosed).toBe(true);
      expect(patient.lname).toBeTruthy();
      // eslint-disable-next-line no-console
      console.log(`Golden path OK: ${patient.fullName} queue=${queueNumber ?? 'N/A'}`);
    });
  });
});
